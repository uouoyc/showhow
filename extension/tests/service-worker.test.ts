import assert from "node:assert/strict";
import { test } from "node:test";

type RuntimeListener = (
  message: unknown,
  sender: { tab?: { id?: number; windowId?: number } },
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

type TabActivatedListener = (activeInfo: {
  tabId: number;
  windowId: number;
}) => Promise<void> | void;

test("runtime messages capture, upload, and stop a Recording", async () => {
  const stored: Record<string, unknown> = {};
  const requests: string[] = [];
  const uploadedSequences: number[] = [];
  let activeTabId = 7;
  let captures = 0;
  let fetchFailuresRemaining = 0;
  let listener: RuntimeListener | undefined;
  let tabActivatedListener: TabActivatedListener | undefined;
  const injectedTabs: number[] = [];

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      action: {
        setBadgeBackgroundColor: async () => undefined,
        setBadgeText: async () => undefined,
      },
      runtime: {
        onMessage: {
          addListener: (registered: RuntimeListener) => {
            listener = registered;
          },
        },
      },
      scripting: {
        executeScript: async ({ target }: { target: { tabId: number } }) => {
          injectedTabs.push(target.tabId);
        },
      },
      storage: {
        local: {
          get: async (keys: string | string[]) => {
            const names = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(
              names
                .filter((name) => name in stored)
                .map((name) => [name, stored[name]]),
            );
          },
          remove: async (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) {
              delete stored[key];
            }
          },
          set: async (values: Record<string, unknown>) => {
            Object.assign(stored, values);
          },
        },
      },
      tabs: {
        onActivated: {
          addListener: (registered: TabActivatedListener) => {
            tabActivatedListener = registered;
          },
        },
        captureVisibleTab: async () => {
          captures++;
          return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        },
        get: async (tabId: number) => ({
          id: tabId,
          url: "https://example.test",
        }),
        query: async () => [{ id: activeTabId }],
        sendMessage: async (tabId: number) => {
          if (!injectedTabs.includes(tabId)) {
            throw new Error("Receiving end does not exist.");
          }
          return { ok: true };
        },
      },
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push(String(input));
    if (fetchFailuresRemaining > 0) {
      fetchFailuresRemaining--;
      return new Response(null, { status: 503 });
    }
    if (String(input).endsWith("/steps")) {
      uploadedSequences.push(JSON.parse(String(init?.body)).sequence);
    }
    return new Response(null, { status: 201 });
  };

  try {
    await import("../src/service-worker");
    assert.ok(listener);

    const dispatch = (
      message: unknown,
      sender: { tab?: { id?: number; windowId?: number } } = {},
    ) =>
      new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Extension message timed out.")),
          2_000,
        );
        const sendResponse = (response: unknown) => {
          clearTimeout(timeout);
          resolve(response);
        };
        if (!listener?.(message, sender, sendResponse)) {
          clearTimeout(timeout);
          resolve(undefined);
        }
      });

    const recording = {
      serverUrl: "http://localhost:3000",
      stepCount: 0,
      title: "Runtime test",
      walkthroughId: "walkthrough-id",
      windowId: 1,
    };
    assert.deepEqual(await dispatch({ recording, type: "start-recording" }), {
      ok: true,
    });
    assert.ok(tabActivatedListener);
    stored.captureError = "Showhow cannot capture the active tab.";
    await tabActivatedListener({ tabId: 8, windowId: 1 });
    assert.deepEqual(injectedTabs, [8]);
    assert.equal("captureError" in stored, false);

    const capture = {
      clickX: 10,
      clickY: 20,
      elementLabel: "button Continue",
      elementRect: { height: 30, width: 80, x: 5, y: 10 },
      pageUrl: "https://example.test",
      viewportHeight: 720,
      viewportWidth: 1280,
    };
    const encrypted = (await dispatch(
      { capture, type: "encrypt-frame-capture" },
      { tab: { id: 7, windowId: 1 } },
    )) as { message?: unknown };
    assert.ok(encrypted.message);
    assert.deepEqual(
      await dispatch(
        { message: encrypted.message, type: "decrypt-frame-capture" },
        { tab: { id: 7, windowId: 1 } },
      ),
      { capture },
    );

    assert.deepEqual(
      await dispatch(
        { capture, type: "capture-click" },
        { tab: { id: 8, windowId: 1 } },
      ),
      { ok: true },
    );
    assert.equal(captures, 0);

    assert.deepEqual(
      await dispatch(
        { capture, type: "capture-click" },
        { tab: { id: 7, windowId: 1 } },
      ),
      { ok: true },
    );
    assert.equal(captures, 1);
    assert.match(requests[0], /\/steps$/);

    activeTabId = 8;
    assert.deepEqual(
      await dispatch(
        { capture, type: "capture-click" },
        { tab: { id: 8, windowId: 1 } },
      ),
      { ok: true },
    );
    assert.equal(captures, 2);
    assert.match(requests[1], /\/steps$/);

    fetchFailuresRemaining = 4;
    assert.deepEqual(
      await dispatch(
        { capture, type: "capture-click" },
        { tab: { id: 8, windowId: 1 } },
      ),
      { ok: false },
    );
    assert.equal(captures, 3);
    assert.ok(stored.pendingUpload);

    await import(
      new URL(`../src/service-worker.ts?restart=${Date.now()}`, import.meta.url)
        .href
    );
    assert.deepEqual(
      await dispatch(
        { capture, type: "capture-click" },
        { tab: { id: 8, windowId: 1 } },
      ),
      { ok: true },
    );
    assert.equal(captures, 4);
    assert.deepEqual(uploadedSequences, [1, 2, 3, 4]);
    assert.equal("captureError" in stored, false);
    assert.equal("pendingUpload" in stored, false);

    assert.deepEqual(await dispatch({ type: "stop-recording" }), {
      editorUrl: "http://localhost:3000/edit/walkthrough-id",
      ok: true,
    });
    assert.match(requests.at(-1) ?? "", /\/finalize$/);
    assert.equal("recording" in stored, false);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "chrome");
  }
});

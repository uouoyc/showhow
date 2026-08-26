import {
  CaptureQueueStoppedError,
  isActiveSourceTab,
  retryUpload,
  SerialCaptureQueue,
} from "./capture-queue.js";
import { ensureContentScript } from "./content-script-control.js";
import {
  createFrameKey,
  decryptFrameCapture,
  type EncryptedFrameCapture,
  encryptFrameCapture,
} from "./frame-message.js";
import type {
  ShowhowCaptureClickMessage,
  ShowhowClickCapture,
  ShowhowRecordingState,
  ShowhowStopRecordingResult,
} from "./types.js";

let captureQueue = new SerialCaptureQueue(500);
const frameKeys = new Map<number, string>();
let stopping: Promise<ShowhowStopRecordingResult> | undefined;
const unavailableTabError = "Showhow cannot capture the active tab.";

type PendingUpload = {
  body: string;
  sequence: number;
  url: string;
  walkthroughId: string;
};

function frameKey(tabId: number): string {
  let key = frameKeys.get(tabId);
  if (!key) {
    key = createFrameKey();
    frameKeys.set(tabId, key);
  }
  return key;
}

function extensionMessage(
  message: unknown,
): (Record<string, unknown> & { type: string }) | undefined {
  if (
    typeof message !== "object" ||
    message === null ||
    !("type" in message) ||
    typeof message.type !== "string"
  ) {
    return undefined;
  }
  return message as Record<string, unknown> & { type: string };
}

function isPopupSender(sender: chrome.runtime.MessageSender): boolean {
  return !sender.tab || sender.url === chrome.runtime.getURL("popup.html");
}

async function recordingState(): Promise<ShowhowRecordingState | undefined> {
  const result = await chrome.storage.local.get("recording");
  return result.recording as ShowhowRecordingState | undefined;
}

async function resumePendingUpload(): Promise<void> {
  const stored = await chrome.storage.local.get(["pendingUpload", "recording"]);
  const pending = stored.pendingUpload as PendingUpload | undefined;

  if (!pending) {
    return;
  }

  await retryUpload(async () => {
    const response = await fetch(pending.url, {
      body: pending.body,
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Step upload failed.");
    }
  });

  const recording = stored.recording as ShowhowRecordingState | undefined;
  if (
    recording?.walkthroughId === pending.walkthroughId &&
    recording.stepCount < pending.sequence
  ) {
    recording.stepCount = pending.sequence;
    await chrome.storage.local.set({ recording });
  }
  await chrome.storage.local.remove(["captureError", "pendingUpload"]);
}

async function setCaptureError(message: string) {
  await chrome.storage.local.set({ captureError: message });
  await chrome.action.setBadgeBackgroundColor({ color: "#b91c1c" });
  await chrome.action.setBadgeText({ text: "!" });
}

async function handleTabActivated({
  tabId,
  windowId,
}: {
  tabId: number;
  windowId: number;
}) {
  const recording = await recordingState();
  if (!recording || recording.windowId !== windowId) {
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !/^https?:\/\//.test(tab.url)) {
      throw new Error();
    }
    if (!(await ensureContentScript(tabId))) {
      throw new Error();
    }
    const { captureError } = await chrome.storage.local.get("captureError");
    if (captureError === unavailableTabError) {
      await chrome.storage.local.remove("captureError");
      await chrome.action.setBadgeBackgroundColor({ color: "#18181b" });
      await chrome.action.setBadgeText({ text: String(recording.stepCount) });
    }
  } catch {
    await setCaptureError(unavailableTabError);
  }
}

async function captureStep(
  message: ShowhowCaptureClickMessage,
  sender: chrome.runtime.MessageSender,
) {
  if (stopping || !(await recordingState())) {
    return;
  }

  const sourceTabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  const captureId = crypto.randomUUID();

  if (sourceTabId === undefined || windowId === undefined) {
    throw new Error("The source tab is unavailable.");
  }

  try {
    return await captureQueue.enqueue(async () => {
      await resumePendingUpload();
      const recording = await recordingState();
      if (!recording || recording.windowId !== windowId) {
        return;
      }

      const [activeTab] = await chrome.tabs.query({ active: true, windowId });
      if (!isActiveSourceTab(sourceTabId, activeTab?.id)) {
        return;
      }

      const sequence = recording.stepCount + 1;
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: "png",
      });
      const [stillActiveTab] = await chrome.tabs.query({
        active: true,
        windowId,
      });
      if (!isActiveSourceTab(sourceTabId, stillActiveTab?.id)) {
        return;
      }
      const body = JSON.stringify({
        ...message.capture,
        captureId,
        screenshotDataUrl,
        sequence,
      });

      const pendingUpload: PendingUpload = {
        body,
        sequence,
        url: `${recording.serverUrl}/api/walkthroughs/${recording.walkthroughId}/steps`,
        walkthroughId: recording.walkthroughId,
      };
      await chrome.storage.local.set({ pendingUpload });
      await resumePendingUpload();
      const updatedRecording = await recordingState();
      const { captureError } = await chrome.storage.local.get("captureError");
      if (typeof captureError !== "string") {
        await chrome.action.setBadgeBackgroundColor({ color: "#18181b" });
        await chrome.action.setBadgeText({
          text: String(updatedRecording?.stepCount ?? sequence),
        });
      }
    });
  } catch (error) {
    if (
      error instanceof CaptureQueueStoppedError ||
      !(await recordingState())
    ) {
      return;
    }
    throw error;
  }
}

async function startRecording(recording: ShowhowRecordingState) {
  await resumePendingUpload();
  captureQueue = new SerialCaptureQueue(500);
  frameKeys.clear();
  stopping = undefined;
  await chrome.storage.local.remove(["captureError", "lastStop"]);
  await chrome.storage.local.set({ recording, serverUrl: recording.serverUrl });
  await chrome.action.setBadgeBackgroundColor({ color: "#18181b" });
  await chrome.action.setBadgeText({ text: "0" });
}

async function stopRecording(): Promise<ShowhowStopRecordingResult> {
  if (stopping) {
    return stopping;
  }

  const operation = (async () => {
    const stored = await chrome.storage.local.get(["recording", "lastStop"]);
    const recording = stored.recording as ShowhowRecordingState | undefined;
    const lastStop = stored.lastStop as ShowhowStopRecordingResult | undefined;

    if (!recording) {
      if (lastStop) {
        return lastStop;
      }
      throw new Error("No Recording is active.");
    }

    await captureQueue.stop();
    await resumePendingUpload();
    try {
      const response = await fetch(
        `${recording.serverUrl}/api/walkthroughs/${recording.walkthroughId}/finalize`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error();
      }
    } catch {
      await setCaptureError(
        "Description drafting could not finish. Recorded labels were kept.",
      );
    }
    const { captureError } = await chrome.storage.local.get("captureError");
    const result: ShowhowStopRecordingResult = {
      editorUrl: `${recording.serverUrl}/edit/${recording.walkthroughId}`,
      ok: true,
    };

    await chrome.storage.local.remove("recording");
    frameKeys.clear();
    await chrome.storage.local.set({ lastStop: result });
    if (typeof captureError !== "string") {
      await chrome.action.setBadgeText({ text: "" });
    }
    captureQueue = new SerialCaptureQueue(500);
    return result;
  })();

  stopping = operation;
  try {
    return await operation;
  } finally {
    stopping = undefined;
  }
}

chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse) => {
    const received = extensionMessage(message);
    if (!received) {
      return false;
    }

    if (
      received.type === "encrypt-frame-capture" &&
      sender.tab?.id !== undefined &&
      "capture" in received
    ) {
      encryptFrameCapture(received.capture, frameKey(sender.tab.id))
        .then((message) => sendResponse({ message }))
        .catch(() => sendResponse({}));
      return true;
    }

    if (
      received.type === "decrypt-frame-capture" &&
      sender.tab?.id !== undefined &&
      "message" in received
    ) {
      decryptFrameCapture<ShowhowClickCapture>(
        received.message as EncryptedFrameCapture,
        frameKey(sender.tab.id),
      )
        .then((capture) => sendResponse({ capture }))
        .catch(() => sendResponse({}));
      return true;
    }

    if (received.type === "capture-click" && "capture" in received) {
      captureStep(received as ShowhowCaptureClickMessage, sender)
        .then(() => sendResponse({ ok: true }))
        .catch(async (error: unknown) => {
          const detail =
            error instanceof Error ? error.message : "Step capture failed.";
          await setCaptureError(detail);
          sendResponse({ ok: false });
        });
      return true;
    }

    if (
      received.type === "start-recording" &&
      "recording" in received &&
      isPopupSender(sender)
    ) {
      startRecording(received.recording as ShowhowRecordingState)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (received.type === "stop-recording" && isPopupSender(sender)) {
      stopRecording()
        .then(sendResponse)
        .catch((error: unknown) =>
          sendResponse({
            error:
              error instanceof Error
                ? error.message
                : "Unable to stop Recording.",
            ok: false,
          }),
        );
      return true;
    }

    return false;
  },
);

chrome.tabs.onActivated.addListener(handleTabActivated);

import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureContentScript } from "../src/content-script-control";

test("missing content script is injected once and verified", async () => {
  let injected = false;
  let injections = 0;
  let messages = 0;
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      scripting: {
        executeScript: async () => {
          injected = true;
          injections++;
        },
      },
      tabs: {
        sendMessage: async () => {
          messages++;
          if (!injected) {
            throw new Error("Receiving end does not exist.");
          }
          return { ok: true };
        },
      },
    },
  });

  try {
    assert.equal(await ensureContentScript(8), true);
    assert.equal(await ensureContentScript(8), true);
    assert.equal(injections, 1);
    assert.equal(messages, 3);
  } finally {
    Reflect.deleteProperty(globalThis, "chrome");
  }
});

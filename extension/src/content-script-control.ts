import type { ShowhowPingMessage } from "./types.js";

async function pingContentScript(tabId: number): Promise<boolean> {
  try {
    const response: { ok?: boolean } = await chrome.tabs.sendMessage(tabId, {
      type: "recording-ping",
    } satisfies ShowhowPingMessage);
    return response.ok === true;
  } catch {
    return false;
  }
}

export async function ensureContentScript(tabId: number): Promise<boolean> {
  if (await pingContentScript(tabId)) {
    return true;
  }
  try {
    await chrome.scripting.executeScript({
      files: ["dist/content-script.js"],
      target: { allFrames: true, tabId },
    });
  } catch {
    return false;
  }
  return pingContentScript(tabId);
}

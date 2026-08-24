function isCaptureClickMessage(
  message: unknown,
): message is ShowhowCaptureClickMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "capture-click" &&
    "capture" in message
  );
}

async function recordingState(): Promise<ShowhowRecordingState | undefined> {
  const result = await chrome.storage.local.get("recording");
  return result.recording as ShowhowRecordingState | undefined;
}

async function captureStep(
  message: ShowhowCaptureClickMessage,
  sender: chrome.runtime.MessageSender,
) {
  const recording = await recordingState();

  if (!recording || sender.tab?.windowId === undefined) {
    return;
  }

  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(
    sender.tab.windowId,
    {
      format: "png",
    },
  );
  const response = await fetch(
    `${recording.serverUrl}/api/walkthroughs/${recording.walkthroughId}/steps`,
    {
      body: JSON.stringify({
        ...message.capture,
        captureId: crypto.randomUUID(),
        screenshotDataUrl,
        sequence: recording.stepCount + 1,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Step upload failed.");
  }

  recording.stepCount++;
  await chrome.storage.local.set({ recording });
  await chrome.action.setBadgeBackgroundColor({ color: "#18181b" });
  await chrome.action.setBadgeText({ text: String(recording.stepCount) });
}

chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse) => {
    if (!isCaptureClickMessage(message)) {
      return false;
    }

    captureStep(message, sender)
      .then(() => sendResponse({ ok: true }))
      .catch(async () => {
        await chrome.action.setBadgeBackgroundColor({ color: "#b91c1c" });
        await chrome.action.setBadgeText({ text: "!" });
        sendResponse({ ok: false });
      });

    return true;
  },
);

import {
  CaptureQueueStoppedError,
  retryUpload,
  SerialCaptureQueue,
} from "./capture-queue.js";

let captureQueue = new SerialCaptureQueue(500);
let stopping: Promise<ShowhowStopRecordingResult> | undefined;

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

async function recordingState(): Promise<ShowhowRecordingState | undefined> {
  const result = await chrome.storage.local.get("recording");
  return result.recording as ShowhowRecordingState | undefined;
}

async function setCaptureError(message: string) {
  await chrome.storage.local.set({ captureError: message });
  await chrome.action.setBadgeBackgroundColor({ color: "#b91c1c" });
  await chrome.action.setBadgeText({ text: "!" });
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
      const recording = await recordingState();
      if (!recording) {
        return;
      }

      const [activeTab] = await chrome.tabs.query({ active: true, windowId });
      if (activeTab?.id !== sourceTabId) {
        throw new Error("The recorded tab is no longer active.");
      }

      const sequence = recording.stepCount + 1;
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: "png",
      });
      const body = JSON.stringify({
        ...message.capture,
        captureId,
        screenshotDataUrl,
        sequence,
      });

      await retryUpload(async () => {
        const response = await fetch(
          `${recording.serverUrl}/api/walkthroughs/${recording.walkthroughId}/steps`,
          {
            body,
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        );
        if (!response.ok) {
          throw new Error("Step upload failed.");
        }
      });

      recording.stepCount = sequence;
      await chrome.storage.local.set({ recording });
      const { captureError } = await chrome.storage.local.get("captureError");
      if (typeof captureError !== "string") {
        await chrome.action.setBadgeBackgroundColor({ color: "#18181b" });
        await chrome.action.setBadgeText({ text: String(sequence) });
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
  captureQueue = new SerialCaptureQueue(500);
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
      !sender.tab
    ) {
      startRecording(received.recording as ShowhowRecordingState)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (received.type === "stop-recording" && !sender.tab) {
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

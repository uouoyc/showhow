import { ensureContentScript } from "./content-script-control.js";
import type {
  ShowhowErrorResult,
  ShowhowRecordingState,
  ShowhowStartRecordingMessage,
  ShowhowStopRecordingMessage,
  ShowhowStopRecordingResult,
} from "./types.js";

function popupElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error("Popup markup is incomplete.");
  }
  return element;
}

const form = popupElement<HTMLFormElement>("#start-form");
const recordingSection = popupElement<HTMLElement>("#recording");
const recordingTitle = popupElement<HTMLElement>("#recording-title");
const serverUrlInput = popupElement<HTMLInputElement>("#server-url");
const statusMessage = popupElement<HTMLElement>("#status");
const stepCount = popupElement<HTMLElement>("#step-count");
const stopButton = popupElement<HTMLButtonElement>("#stop");

function normalizedServerUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Use an HTTP or HTTPS Web server URL.");
  }
  return url.href.replace(/\/$/, "");
}

function render(recording?: ShowhowRecordingState) {
  form.hidden = Boolean(recording);
  recordingSection.hidden = !recording;
  recordingTitle.textContent = recording?.title ?? "";
  stepCount.textContent = String(recording?.stepCount ?? 0);
}

async function initializePopup() {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusMessage.textContent = "";

    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.url || !/^https?:\/\//.test(activeTab.url)) {
        throw new Error(
          "Open an HTTP or HTTPS page before starting a Recording.",
        );
      }
      if (activeTab.id === undefined) {
        throw new Error("The active tab is unavailable.");
      }

      if (!(await ensureContentScript(activeTab.id))) {
        throw new Error(
          "Showhow cannot capture this page. Open another HTTP(S) page.",
        );
      }

      const data = new FormData(form);
      const title = String(data.get("title") ?? "").trim();
      const serverUrl = normalizedServerUrl(
        String(data.get("server-url") ?? ""),
      );
      const response = await fetch(`${serverUrl}/api/walkthroughs`, {
        body: JSON.stringify({ title }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to start Recording.");
      }

      const body: { walkthrough: { id: string } } = await response.json();
      const recording: ShowhowRecordingState = {
        serverUrl,
        stepCount: 0,
        title,
        walkthroughId: body.walkthrough.id,
        windowId: activeTab.windowId,
      };

      const started: { ok: boolean } = await chrome.runtime.sendMessage({
        type: "start-recording",
        recording,
      } satisfies ShowhowStartRecordingMessage);
      if (!started.ok) {
        throw new Error("Unable to start Recording.");
      }
      render(recording);
    } catch (reason) {
      statusMessage.textContent =
        reason instanceof Error ? reason.message : "Unable to start Recording.";
    }
  });

  stopButton.addEventListener("click", async () => {
    statusMessage.textContent = "Stopping…";
    stopButton.disabled = true;

    try {
      const result: ShowhowStopRecordingResult | ShowhowErrorResult =
        await chrome.runtime.sendMessage({
          type: "stop-recording",
        } satisfies ShowhowStopRecordingMessage);

      if (!result.ok) {
        statusMessage.textContent = result.error;
        return;
      }

      await chrome.tabs.create({ url: result.editorUrl });
      statusMessage.textContent = "";
      render();
    } catch (reason) {
      statusMessage.textContent =
        reason instanceof Error ? reason.message : "Unable to stop Recording.";
    } finally {
      stopButton.disabled = false;
    }
  });

  const stored = await chrome.storage.local.get([
    "captureError",
    "recording",
    "serverUrl",
  ]);
  const activeRecording = stored.recording as ShowhowRecordingState | undefined;
  serverUrlInput.value =
    typeof stored.serverUrl === "string"
      ? stored.serverUrl
      : serverUrlInput.value;
  render(activeRecording);
  statusMessage.textContent =
    typeof stored.captureError === "string" ? stored.captureError : "";
}

void initializePopup();

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
  const stored = await chrome.storage.local.get(["recording", "serverUrl"]);
  const activeRecording = stored.recording as ShowhowRecordingState | undefined;
  serverUrlInput.value =
    typeof stored.serverUrl === "string"
      ? stored.serverUrl
      : serverUrlInput.value;
  render(activeRecording);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusMessage.textContent = "";

    try {
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
      };

      await chrome.storage.local.set({ recording, serverUrl });
      await chrome.action.setBadgeText({ text: "0" });
      render(recording);
    } catch (reason) {
      statusMessage.textContent =
        reason instanceof Error ? reason.message : "Unable to start Recording.";
    }
  });

  stopButton.addEventListener("click", async () => {
    const { recording } = await chrome.storage.local.get("recording");
    const current = recording as ShowhowRecordingState | undefined;

    if (!current) {
      render();
      return;
    }

    await chrome.storage.local.remove("recording");
    await chrome.action.setBadgeText({ text: "" });
    await chrome.tabs.create({
      url: `${current.serverUrl}/edit/${current.walkthroughId}`,
    });
    render();
  });
}

void initializePopup();

import {
  claimEncryptedFrameCapture,
  normalizeEncryptedFrameCapture,
  releaseEncryptedFrameCapture,
} from "./frame-message.js";
import type {
  ShowhowCaptureClickMessage,
  ShowhowClickCapture,
} from "./types.js";

function elementLabel(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const description =
    element.getAttribute("aria-label")?.trim() ||
    element.textContent?.replaceAll(/\s+/g, " ").trim().slice(0, 80) ||
    "";

  return `${tag} ${description}`.trim().slice(0, 160);
}

const seenFrameMessages = new Set<string>();

async function forwardCapture(capture: ShowhowClickCapture) {
  if (window === window.top) {
    const message: ShowhowCaptureClickMessage = {
      type: "capture-click",
      capture,
    };
    await chrome.runtime.sendMessage(message);
    return;
  }

  const response: { message?: unknown } = await chrome.runtime.sendMessage({
    capture,
    type: "encrypt-frame-capture",
  });
  const message = normalizeEncryptedFrameCapture(response.message);
  if (!message) {
    throw new Error("Unable to secure iframe capture data.");
  }
  window.parent.postMessage(message, "*");
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "recording-ping"
    ) {
      sendResponse({ ok: true });
    }
    return false;
  },
);

window.addEventListener("message", async (event) => {
  const candidate = normalizeEncryptedFrameCapture(event.data);

  if (!candidate) {
    return;
  }

  const iframe = Array.from(document.querySelectorAll("iframe")).find(
    (candidate) => candidate.contentWindow === event.source,
  );

  if (!iframe) {
    return;
  }
  const message = claimEncryptedFrameCapture(seenFrameMessages, candidate);
  if (!message) {
    return;
  }

  let capture: ShowhowClickCapture;
  try {
    const response: { capture?: ShowhowClickCapture } =
      await chrome.runtime.sendMessage({
        message,
        type: "decrypt-frame-capture",
      });
    if (!response.capture) {
      throw new Error("Unable to authenticate iframe capture data.");
    }
    capture = response.capture;
  } catch {
    releaseEncryptedFrameCapture(seenFrameMessages, message);
    return;
  }

  const frameRect = iframe.getBoundingClientRect();
  if (
    iframe.offsetWidth === 0 ||
    iframe.offsetHeight === 0 ||
    capture.viewportWidth === 0 ||
    capture.viewportHeight === 0
  ) {
    return;
  }

  const borderScaleX = frameRect.width / iframe.offsetWidth;
  const borderScaleY = frameRect.height / iframe.offsetHeight;
  const contentScaleX =
    (iframe.clientWidth * borderScaleX) / capture.viewportWidth;
  const contentScaleY =
    (iframe.clientHeight * borderScaleY) / capture.viewportHeight;
  const contentX = frameRect.x + iframe.clientLeft * borderScaleX;
  const contentY = frameRect.y + iframe.clientTop * borderScaleY;

  void forwardCapture({
    ...capture,
    clickX: contentX + capture.clickX * contentScaleX,
    clickY: contentY + capture.clickY * contentScaleY,
    elementRect: {
      ...capture.elementRect,
      height: capture.elementRect.height * contentScaleY,
      width: capture.elementRect.width * contentScaleX,
      x: contentX + capture.elementRect.x * contentScaleX,
      y: contentY + capture.elementRect.y * contentScaleY,
    },
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  }).catch(() => undefined);
});

document.addEventListener(
  "click",
  (event) => {
    if (!event.isTrusted) {
      return;
    }
    const element = event.target instanceof Element ? event.target : null;

    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    void forwardCapture({
      clickX: event.clientX,
      clickY: event.clientY,
      elementLabel: elementLabel(element),
      elementRect: {
        height: rect.height,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      },
      pageUrl: location.href,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }).catch(() => undefined);
  },
  true,
);

function elementLabel(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const description =
    element.getAttribute("aria-label")?.trim() ||
    element.textContent?.replaceAll(/\s+/g, " ").trim().slice(0, 80) ||
    "";

  return `${tag} ${description}`.trim().slice(0, 160);
}

type FrameCaptureMessage = {
  type: "showhow-frame-capture";
  capture: ShowhowClickCapture;
};

function forwardCapture(capture: ShowhowClickCapture) {
  if (window === window.top) {
    const message: ShowhowCaptureClickMessage = {
      type: "capture-click",
      capture,
    };
    void chrome.runtime.sendMessage(message).catch(() => undefined);
    return;
  }

  const message: FrameCaptureMessage = {
    type: "showhow-frame-capture",
    capture,
  };
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

window.addEventListener("message", (event) => {
  const message = event.data as Partial<FrameCaptureMessage> | undefined;

  if (message?.type !== "showhow-frame-capture" || !message.capture) {
    return;
  }

  const iframe = Array.from(document.querySelectorAll("iframe")).find(
    (candidate) => candidate.contentWindow === event.source,
  );

  if (!iframe) {
    return;
  }

  const frameRect = iframe.getBoundingClientRect();
  if (
    iframe.offsetWidth === 0 ||
    iframe.offsetHeight === 0 ||
    message.capture.viewportWidth === 0 ||
    message.capture.viewportHeight === 0
  ) {
    return;
  }

  const borderScaleX = frameRect.width / iframe.offsetWidth;
  const borderScaleY = frameRect.height / iframe.offsetHeight;
  const contentScaleX =
    (iframe.clientWidth * borderScaleX) / message.capture.viewportWidth;
  const contentScaleY =
    (iframe.clientHeight * borderScaleY) / message.capture.viewportHeight;
  const contentX = frameRect.x + iframe.clientLeft * borderScaleX;
  const contentY = frameRect.y + iframe.clientTop * borderScaleY;

  forwardCapture({
    ...message.capture,
    clickX: contentX + message.capture.clickX * contentScaleX,
    clickY: contentY + message.capture.clickY * contentScaleY,
    elementRect: {
      ...message.capture.elementRect,
      height: message.capture.elementRect.height * contentScaleY,
      width: message.capture.elementRect.width * contentScaleX,
      x: contentX + message.capture.elementRect.x * contentScaleX,
      y: contentY + message.capture.elementRect.y * contentScaleY,
    },
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  });
});

document.addEventListener(
  "click",
  (event) => {
    const element = event.target instanceof Element ? event.target : null;

    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    forwardCapture({
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
    });
  },
  true,
);

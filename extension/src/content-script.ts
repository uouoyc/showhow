function elementLabel(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const description =
    element.getAttribute("aria-label")?.trim() ||
    element.textContent?.replaceAll(/\s+/g, " ").trim().slice(0, 80) ||
    "";

  return `${tag} ${description}`.trim().slice(0, 160);
}

document.addEventListener(
  "click",
  (event) => {
    const element = event.target instanceof Element ? event.target : null;

    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const message: ShowhowCaptureClickMessage = {
      type: "capture-click",
      capture: {
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
      },
    };

    void chrome.runtime.sendMessage(message).catch(() => undefined);
  },
  true,
);

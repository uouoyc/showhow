type CaptureCoordinates = {
  clickX: number;
  clickY: number;
  viewportHeight: number;
  viewportWidth: number;
};

type Size = { height: number; width: number };

export function hotspotRatios(capture: CaptureCoordinates) {
  if (capture.viewportWidth <= 0 || capture.viewportHeight <= 0) {
    throw new Error("Capture viewport must be positive.");
  }

  return {
    x: Math.min(1, Math.max(0, capture.clickX / capture.viewportWidth)),
    y: Math.min(1, Math.max(0, capture.clickY / capture.viewportHeight)),
  };
}

export function scaleHotspot(capture: CaptureCoordinates, rendered: Size) {
  const ratios = hotspotRatios(capture);
  return {
    x: ratios.x * rendered.width,
    y: ratios.y * rendered.height,
  };
}

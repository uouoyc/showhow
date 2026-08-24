import assert from "node:assert/strict";
import { test } from "node:test";
import { hotspotRatios, scaleHotspot } from "../lib/hotspot";

const capture = {
  clickX: 320,
  clickY: 180,
  viewportHeight: 720,
  viewportWidth: 1280,
};

test("Hotspot scales with the rendered screenshot", () => {
  assert.deepEqual(hotspotRatios(capture), { x: 0.25, y: 0.25 });
  assert.deepEqual(scaleHotspot(capture, { height: 360, width: 640 }), {
    x: 160,
    y: 90,
  });
  assert.deepEqual(scaleHotspot(capture, { height: 1080, width: 1920 }), {
    x: 480,
    y: 270,
  });
});

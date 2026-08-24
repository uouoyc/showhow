import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dataDir = mkdtempSync(join(tmpdir(), "showhow-step-"));
process.env.DATA_DIR = dataDir;

const { closeDatabase } = await import("../lib/database");
const { createWalkthrough } = await import("../lib/walkthroughs");
const { createStep, listSteps } = await import("../lib/steps");
const { POST } = await import("../app/api/walkthroughs/[id]/steps/route");
const { GET: getScreenshot } = await import("../app/api/screens/[file]/route");

after(() => {
  closeDatabase();
  rmSync(dataDir, { force: true, recursive: true });
});

test("captured Step and screenshot are stored idempotently", () => {
  const walkthrough = createWalkthrough("Capture test");
  const capture = {
    captureId: "11111111-1111-4111-8111-111111111111",
    clickX: 120,
    clickY: 80,
    elementLabel: "button Save",
    elementRect: { height: 40, width: 100, x: 90, y: 60 },
    pageUrl: "https://example.test/settings",
    screenshotDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    sequence: 1,
    viewportHeight: 720,
    viewportWidth: 1280,
  };

  const step = createStep(walkthrough.id, capture);
  const repeated = createStep(walkthrough.id, capture);

  assert.deepEqual(repeated, step);
  assert.deepEqual(listSteps(walkthrough.id), [step]);
  assert.equal(
    existsSync(join(dataDir, "screenshots", step.screenshotFile)),
    true,
  );
});

test("capture retry recovers when its screenshot already exists", () => {
  const walkthrough = createWalkthrough("Interrupted capture");
  const captureId = "44444444-4444-4444-8444-444444444444";
  const screenshot = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  writeFileSync(join(dataDir, "screenshots", `${captureId}.png`), screenshot);

  const step = createStep(walkthrough.id, {
    captureId,
    clickX: 1,
    clickY: 1,
    elementLabel: "button Retry",
    elementRect: { height: 1, width: 1, x: 0, y: 0 },
    pageUrl: "https://example.test/retry",
    screenshotDataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
    sequence: 1,
    viewportHeight: 100,
    viewportWidth: 100,
  });

  assert.equal(step.captureId, captureId);
  assert.deepEqual(listSteps(walkthrough.id), [step]);
});

test("API stores a captured Step and serves its screenshot", async () => {
  const walkthrough = createWalkthrough("API capture");
  const response = await POST(
    new Request(
      `http://showhow.test/api/walkthroughs/${walkthrough.id}/steps`,
      {
        body: JSON.stringify({
          captureId: "22222222-2222-4222-8222-222222222222",
          clickX: 42,
          clickY: 24,
          elementLabel: "button Continue",
          elementRect: { height: 30, width: 90, x: 20, y: 10 },
          pageUrl: "https://example.test/start",
          screenshotDataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          sequence: 1,
          viewportHeight: 720,
          viewportWidth: 1280,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    ),
    { params: Promise.resolve({ id: walkthrough.id }) },
  );
  assert.equal(response.status, 201);

  const { step } = await response.json();
  const screenshotResponse = await getScreenshot(
    new Request("http://showhow.test"),
    {
      params: Promise.resolve({ file: step.screenshotFile }),
    },
  );

  assert.equal(screenshotResponse.status, 200);
  assert.equal(screenshotResponse.headers.get("content-type"), "image/png");
  assert.equal(
    screenshotResponse.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );

  const invalidResponse = await getScreenshot(
    new Request("http://showhow.test"),
    {
      params: Promise.resolve({ file: "../showhow.db" }),
    },
  );
  assert.equal(invalidResponse.status, 404);
});

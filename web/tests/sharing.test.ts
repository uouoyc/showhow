import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import sharp from "sharp";

const dataDir = mkdtempSync(join(tmpdir(), "showhow-sharing-"));
process.env.DATA_DIR = dataDir;

const { closeDatabase } = await import("../lib/database");
const { exportWalkthrough } = await import("../lib/portable-walkthrough");
const { recordCompletion, recordView } = await import("../lib/stats");
const { createStep, updateStep } = await import("../lib/steps");
const { createWalkthrough, findWalkthroughById, listWalkthroughs } =
  await import("../lib/walkthroughs");
const { POST: postStats } = await import(
  "../app/api/walkthroughs/[id]/stats/route"
);
const { GET: getExport } = await import(
  "../app/api/walkthroughs/[id]/export/route"
);
const { POST: postImport } = await import(
  "../app/api/walkthroughs/import/route"
);

after(() => {
  closeDatabase();
  rmSync(dataDir, { force: true, recursive: true });
});

test("views are counted and completion retries are idempotent", () => {
  const walkthrough = createWalkthrough("Stats");
  const otherWalkthrough = createWalkthrough("Other stats");
  const sharedCompletionId = "11111111-1111-4111-8111-111111111111";

  recordView(walkthrough.id);
  recordView(walkthrough.id);
  recordCompletion(walkthrough.id, sharedCompletionId);
  recordCompletion(walkthrough.id, sharedCompletionId);
  recordCompletion(walkthrough.id, "22222222-2222-4222-8222-222222222222");
  recordCompletion(otherWalkthrough.id, sharedCompletionId);

  const counted = findWalkthroughById(walkthrough.id);
  assert.equal(counted?.views, 2);
  assert.equal(counted?.completions, 2);
  assert.equal(findWalkthroughById(otherWalkthrough.id)?.completions, 1);
});

test("Walkthrough export contains ordered redacted capture data", async () => {
  const walkthrough = createWalkthrough("Export");
  const step = createStep(walkthrough.id, {
    captureId: "33333333-3333-4333-8333-333333333333",
    clickX: 25,
    clickY: 50,
    elementLabel: "button Export",
    elementRect: { height: 20, width: 80, x: 10, y: 40 },
    pageUrl: "https://example.test/export",
    screenshotDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQYlWP4jxcwjEr/xwIA+h4q5HxTIAQAAAAASUVORK5CYII=",
    sequence: 1,
    viewportHeight: 100,
    viewportWidth: 200,
  });
  const savedStep = updateStep(walkthrough.id, step.id, {
    clickX: step.clickX,
    clickY: step.clickY,
    description: step.description,
    redactions: [{ height: 1, width: 0.5, x: 0, y: 0 }],
    title: step.title,
  });
  assert.ok(savedStep);

  const exported = await exportWalkthrough(walkthrough.id);

  assert.equal(exported?.formatVersion, 1);
  assert.equal(exported?.walkthrough.slug, walkthrough.slug);
  assert.match(
    exported?.steps[0].screenshotDataUrl ?? "",
    /^data:image\/png;base64,/,
  );
  const pixels = await sharp(
    Buffer.from(
      exported?.steps[0].screenshotDataUrl.split(",")[1] ?? "",
      "base64",
    ),
  )
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.deepEqual([...pixels.subarray(0, 3)], [0, 0, 0]);
  assert.deepEqual([...pixels.subarray(27, 30)], [255, 255, 255]);
  assert.deepEqual(exported?.steps, [
    {
      captureId: step.captureId,
      clickX: 25,
      clickY: 50,
      description: step.description,
      elementLabel: step.elementLabel,
      elementRect: { height: 20, width: 80, x: 10, y: 40 },
      pageUrl: step.pageUrl,
      redactions: savedStep.redactions,
      screenshotDataUrl: exported.steps[0].screenshotDataUrl,
      sequence: 1,
      title: step.title,
      viewportHeight: 100,
      viewportWidth: 200,
    },
  ]);
});

test("public stats and JSON export routes expose the services", async () => {
  const walkthrough = createWalkthrough("Route sharing");
  const statsParams = { params: Promise.resolve({ id: walkthrough.id }) };

  const viewResponse = await postStats(
    new Request("http://showhow.test", {
      body: JSON.stringify({ type: "view" }),
      method: "POST",
    }),
    statsParams,
  );
  assert.equal(viewResponse.status, 204);

  const completionId = "44444444-4444-4444-8444-444444444444";
  const completionRequest = () =>
    new Request("http://showhow.test", {
      body: JSON.stringify({ completionId, type: "completion" }),
      method: "POST",
    });
  assert.equal((await postStats(completionRequest(), statsParams)).status, 204);
  assert.equal((await postStats(completionRequest(), statsParams)).status, 204);
  assert.equal(findWalkthroughById(walkthrough.id)?.completions, 1);

  const exportResponse = await getExport(new Request("http://showhow.test"), {
    params: Promise.resolve({ id: walkthrough.id }),
  });
  assert.equal(exportResponse.status, 200);
  assert.match(
    exportResponse.headers.get("content-disposition") ?? "",
    /attachment/,
  );
  assert.equal(
    (await exportResponse.json()).walkthrough.slug,
    walkthrough.slug,
  );
});

test("portable JSON import restores a new Walkthrough and its screenshot", async () => {
  const source = createWalkthrough("Portable source");
  createStep(source.id, {
    captureId: "55555555-5555-4555-8555-555555555555",
    clickX: 25,
    clickY: 75,
    elementLabel: "button Restore",
    elementRect: { height: 20, width: 40, x: 10, y: 60 },
    pageUrl: "https://example.test/restore",
    screenshotDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    sequence: 1,
    viewportHeight: 100,
    viewportWidth: 100,
  });
  const exported = await exportWalkthrough(source.id);
  assert.ok(exported);

  const response = await postImport(
    new Request("http://showhow.test/api/walkthroughs/import", {
      body: JSON.stringify(exported),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
  assert.equal(response.status, 201);
  const { steps: importedSteps, walkthrough } = await response.json();
  assert.notEqual(walkthrough.id, source.id);
  assert.equal(walkthrough.title, source.title);
  assert.equal(importedSteps[0].clickX, 25);
  assert.equal(importedSteps[0].clickY, 75);
  assert.equal(
    existsSync(join(dataDir, "screenshots", importedSteps[0].screenshotFile)),
    true,
  );
});

test("portable import rejects duplicate capture IDs without partial data", async () => {
  const source = createWalkthrough("Invalid portable source");
  createStep(source.id, {
    captureId: "66666666-6666-4666-8666-666666666666",
    clickX: 5,
    clickY: 5,
    elementLabel: "button Duplicate",
    elementRect: { height: 2, width: 2, x: 4, y: 4 },
    pageUrl: "https://example.test/duplicate",
    screenshotDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    sequence: 1,
    viewportHeight: 10,
    viewportWidth: 10,
  });
  const exported = await exportWalkthrough(source.id);
  assert.ok(exported);
  const before = listWalkthroughs().length;

  const response = await postImport(
    new Request("http://showhow.test/api/walkthroughs/import", {
      body: JSON.stringify({
        ...exported,
        steps: [exported.steps[0], { ...exported.steps[0], sequence: 2 }],
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(listWalkthroughs().length, before);
});

test("portable import rejects an oversized request before creating data", async () => {
  const before = listWalkthroughs().length;
  const response = await postImport(
    new Request("http://showhow.test/api/walkthroughs/import", {
      body: "{}",
      headers: {
        "content-length": String(256 * 1024 * 1024 + 1),
        "content-type": "application/json",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 413);
  assert.equal(listWalkthroughs().length, before);
});

test("portable import rejects too many Steps before creating data", async () => {
  const before = listWalkthroughs().length;
  const steps = Array.from({ length: 251 }, (_, index) => ({
    captureId: `${index.toString(16).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
    clickX: 1,
    clickY: 1,
    description: "Imported Step",
    elementLabel: "button Import",
    elementRect: { height: 1, width: 1, x: 0, y: 0 },
    pageUrl: "https://example.test/import-limit",
    redactions: [],
    screenshotDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    sequence: index + 1,
    title: "Imported Step",
    viewportHeight: 10,
    viewportWidth: 10,
  }));
  const response = await postImport(
    new Request("http://showhow.test/api/walkthroughs/import", {
      body: JSON.stringify({
        formatVersion: 1,
        steps,
        walkthrough: { ctaUrl: null, slug: "ignored", title: "Too many" },
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );

  assert.equal(response.status, 413);
  assert.equal(listWalkthroughs().length, before);
});

test("portable import rejects undecodable screenshots without partial data", async () => {
  const before = listWalkthroughs().length;
  const truncatedScreenshot = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  )
    .subarray(0, 50)
    .toString("base64");
  const response = await postImport(
    new Request("http://showhow.test/api/walkthroughs/import", {
      body: JSON.stringify({
        formatVersion: 1,
        steps: [
          {
            captureId: "77777777-7777-4777-8777-777777777777",
            clickX: 1,
            clickY: 1,
            description: "Invalid image",
            elementLabel: "button Invalid",
            elementRect: { height: 1, width: 1, x: 0, y: 0 },
            pageUrl: "https://example.test/invalid-import",
            redactions: [],
            screenshotDataUrl: `data:image/png;base64,${truncatedScreenshot}`,
            sequence: 1,
            title: "Invalid image",
            viewportHeight: 10,
            viewportWidth: 10,
          },
        ],
        walkthrough: {
          ctaUrl: null,
          slug: "ignored",
          title: "Invalid screenshot",
        },
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(listWalkthroughs().length, before);
});

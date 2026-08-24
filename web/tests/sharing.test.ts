import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dataDir = mkdtempSync(join(tmpdir(), "showhow-sharing-"));
process.env.DATA_DIR = dataDir;

const { closeDatabase } = await import("../lib/database");
const { exportWalkthrough } = await import("../lib/export");
const { recordCompletion, recordView } = await import("../lib/stats");
const { createStep } = await import("../lib/steps");
const { createWalkthrough, findWalkthroughById } = await import(
  "../lib/walkthroughs"
);
const { POST: postStats } = await import(
  "../app/api/walkthroughs/[id]/stats/route"
);
const { GET: getExport } = await import(
  "../app/api/walkthroughs/[id]/export/route"
);

after(() => {
  closeDatabase();
  rmSync(dataDir, { force: true, recursive: true });
});

test("views are counted and completion retries are idempotent", () => {
  const walkthrough = createWalkthrough("Stats");

  recordView(walkthrough.id);
  recordView(walkthrough.id);
  recordCompletion(walkthrough.id, "11111111-1111-4111-8111-111111111111");
  recordCompletion(walkthrough.id, "11111111-1111-4111-8111-111111111111");
  recordCompletion(walkthrough.id, "22222222-2222-4222-8222-222222222222");

  const counted = findWalkthroughById(walkthrough.id);
  assert.equal(counted?.views, 2);
  assert.equal(counted?.completions, 2);
});

test("Walkthrough export contains ordered capture data", () => {
  const walkthrough = createWalkthrough("Export");
  const step = createStep(walkthrough.id, {
    captureId: "33333333-3333-4333-8333-333333333333",
    clickX: 25,
    clickY: 50,
    elementLabel: "button Export",
    elementRect: { height: 20, width: 80, x: 10, y: 40 },
    pageUrl: "https://example.test/export",
    screenshotDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    sequence: 1,
    viewportHeight: 100,
    viewportWidth: 200,
  });

  const exported = exportWalkthrough(walkthrough.id);

  assert.equal(exported?.walkthrough.slug, walkthrough.slug);
  assert.deepEqual(exported?.steps, [
    {
      captureId: step.captureId,
      clickX: 25,
      clickY: 50,
      description: step.description,
      elementLabel: step.elementLabel,
      elementRect: { height: 20, width: 80, x: 10, y: 40 },
      pageUrl: step.pageUrl,
      screenshotFile: step.screenshotFile,
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

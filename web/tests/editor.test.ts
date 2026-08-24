import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dataDir = mkdtempSync(join(tmpdir(), "showhow-editor-"));
process.env.DATA_DIR = dataDir;

const { closeDatabase } = await import("../lib/database");
const { deleteStep, createStep, listSteps, moveStep, updateStep } =
  await import("../lib/steps");
const { createWalkthrough, findWalkthroughById, updateWalkthrough } =
  await import("../lib/walkthroughs");
const { PATCH: patchWalkthrough } = await import(
  "../app/api/walkthroughs/[id]/route"
);
const { DELETE: deleteStepRoute, PATCH: patchStep } = await import(
  "../app/api/walkthroughs/[id]/steps/[stepId]/route"
);
const { POST: moveStepRoute } = await import(
  "../app/api/walkthroughs/[id]/steps/[stepId]/move/route"
);
const screenshotDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function captureStep(
  walkthroughId: string,
  sequence: number,
  captureId: string,
) {
  return createStep(walkthroughId, {
    captureId,
    clickX: sequence,
    clickY: sequence,
    elementLabel: `button Step ${sequence}`,
    elementRect: { height: 1, width: 1, x: 0, y: 0 },
    pageUrl: `https://example.test/step-${sequence}`,
    screenshotDataUrl,
    sequence,
    viewportHeight: 100,
    viewportWidth: 100,
  });
}

after(() => {
  closeDatabase();
  rmSync(dataDir, { force: true, recursive: true });
});

test("user can edit and organize captured Steps", () => {
  const walkthrough = createWalkthrough("Raw capture");
  const first = captureStep(
    walkthrough.id,
    1,
    "55555555-5555-4555-8555-555555555555",
  );
  const second = captureStep(
    walkthrough.id,
    2,
    "66666666-6666-4666-8666-666666666666",
  );

  updateWalkthrough(walkthrough.id, {
    ctaUrl: "https://example.test/continue",
    title: "Curated Walkthrough",
  });
  updateStep(walkthrough.id, first.id, {
    description: "Choose the first option.",
    title: "Choose an option",
  });
  moveStep(walkthrough.id, second.id, "up");

  const reordered = listSteps(walkthrough.id);
  assert.deepEqual(
    reordered.map((step) => [step.id, step.sequence]),
    [
      [second.id, 1],
      [first.id, 2],
    ],
  );
  assert.equal(reordered[1].title, "Choose an option");
  assert.equal(reordered[1].description, "Choose the first option.");
  assert.equal(
    findWalkthroughById(walkthrough.id)?.title,
    "Curated Walkthrough",
  );
  assert.equal(
    findWalkthroughById(walkthrough.id)?.ctaUrl,
    "https://example.test/continue",
  );

  deleteStep(walkthrough.id, second.id);
  assert.deepEqual(
    listSteps(walkthrough.id).map((step) => [step.id, step.sequence]),
    [[first.id, 1]],
  );
  assert.equal(
    existsSync(join(dataDir, "screenshots", second.screenshotFile)),
    false,
  );
});

test("editor API saves, moves, and deletes", async () => {
  const walkthrough = createWalkthrough("API editor");
  const first = captureStep(
    walkthrough.id,
    1,
    "77777777-7777-4777-8777-777777777777",
  );
  const second = captureStep(
    walkthrough.id,
    2,
    "88888888-8888-4888-8888-888888888888",
  );
  const params = { params: Promise.resolve({ id: walkthrough.id }) };

  const walkthroughResponse = await patchWalkthrough(
    new Request("http://showhow.test", {
      body: JSON.stringify({ ctaUrl: "", title: "Saved title" }),
      method: "PATCH",
    }),
    params,
  );
  assert.equal(walkthroughResponse.status, 200);

  const stepParams = {
    params: Promise.resolve({ id: walkthrough.id, stepId: first.id }),
  };
  const stepResponse = await patchStep(
    new Request("http://showhow.test", {
      body: JSON.stringify({
        description: "Saved description",
        title: "Saved Step",
      }),
      method: "PATCH",
    }),
    stepParams,
  );
  assert.equal(stepResponse.status, 200);

  const moveResponse = await moveStepRoute(
    new Request("http://showhow.test", {
      body: JSON.stringify({ direction: "up" }),
      method: "POST",
    }),
    { params: Promise.resolve({ id: walkthrough.id, stepId: second.id }) },
  );
  assert.equal(moveResponse.status, 200);
  assert.equal(listSteps(walkthrough.id)[0].id, second.id);

  const deleteResponse = await deleteStepRoute(
    new Request("http://showhow.test", { method: "DELETE" }),
    stepParams,
  );
  assert.equal(deleteResponse.status, 204);
  assert.equal(listSteps(walkthrough.id).length, 1);
});

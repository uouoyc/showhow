import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dataDir = mkdtempSync(join(tmpdir(), "showhow-drafting-"));
process.env.DATA_DIR = dataDir;

const { closeDatabase } = await import("../lib/database");
const { finalizeWalkthrough } = await import("../lib/drafting");
const { createStep, listSteps, updateStep } = await import("../lib/steps");
const { createWalkthrough, findWalkthroughById } = await import(
  "../lib/walkthroughs"
);

after(() => {
  closeDatabase();
  rmSync(dataDir, { force: true, recursive: true });
});

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
    screenshotDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    sequence,
    viewportHeight: 100,
    viewportWidth: 100,
  });
}

test("finalization drafts defaults once and preserves user descriptions", async () => {
  const walkthrough = createWalkthrough("Draft descriptions");
  const first = captureStep(
    walkthrough.id,
    1,
    "99999999-9999-4999-8999-999999999999",
  );
  const second = captureStep(
    walkthrough.id,
    2,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  updateStep(walkthrough.id, second.id, {
    description: "My custom description",
    title: second.title,
  });

  let calls = 0;
  const provider = async () => {
    calls++;
    return [
      { captureId: first.captureId, description: "Choose the first option." },
      { captureId: second.captureId, description: "Generated but ignored." },
    ];
  };

  const result = await finalizeWalkthrough(walkthrough.id, provider);
  await finalizeWalkthrough(walkthrough.id, async () => {
    throw new Error("must not be called twice");
  });

  assert.equal(result.drafted, true);
  assert.equal(calls, 1);
  assert.deepEqual(
    listSteps(walkthrough.id).map((step) => step.description),
    ["Choose the first option.", "My custom description"],
  );
});

test("drafting failure keeps labels and records a warning", async () => {
  const walkthrough = createWalkthrough("Failed draft");
  const step = captureStep(
    walkthrough.id,
    1,
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );

  const result = await finalizeWalkthrough(walkthrough.id, async () => {
    throw new Error("provider failed");
  });

  assert.equal(result.drafted, false);
  assert.equal(listSteps(walkthrough.id)[0].description, step.elementLabel);
  assert.equal(
    findWalkthroughById(walkthrough.id)?.draftError,
    "AI drafting failed. Recorded labels were kept.",
  );
});

test("duplicate capture IDs reject the whole draft batch", async () => {
  const walkthrough = createWalkthrough("Duplicate drafts");
  const first = captureStep(
    walkthrough.id,
    1,
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  );
  captureStep(walkthrough.id, 2, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");

  const result = await finalizeWalkthrough(walkthrough.id, async () => [
    { captureId: first.captureId, description: "First draft" },
    { captureId: first.captureId, description: "Duplicate draft" },
  ]);

  assert.equal(result.drafted, false);
  assert.deepEqual(
    listSteps(walkthrough.id).map((step) => step.description),
    ["button Step 1", "button Step 2"],
  );
});

test("Responses adapter uses the configured URL, token, and model", async () => {
  const originalFetch = globalThis.fetch;
  process.env.AI_BASE_URL = "https://provider.example/v1";
  process.env.AI_TOKEN = "placeholder-token";
  process.env.AI_MODEL = "provider-model";

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://provider.example/v1/responses");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer placeholder-token",
    );
    assert.equal(JSON.parse(String(init?.body)).model, "provider-model");

    return new Response(
      JSON.stringify({
        created_at: 0,
        id: "resp_test",
        object: "response",
        output: [
          {
            content: [
              {
                annotations: [],
                text: JSON.stringify({
                  steps: [{ captureId: "capture", description: "Continue." }],
                }),
                type: "output_text",
              },
            ],
            id: "msg_test",
            role: "assistant",
            status: "completed",
            type: "message",
          },
        ],
        status: "completed",
      }),
      { headers: { "content-type": "application/json" } },
    );
  };

  try {
    const { createDescriptionDraftProvider } = await import("../lib/responses");
    const draftDescriptions = createDescriptionDraftProvider();
    assert.ok(draftDescriptions);
    assert.deepEqual(
      await draftDescriptions([
        { captureId: "capture", elementLabel: "button Continue" },
      ]),
      [{ captureId: "capture", description: "Continue." }],
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_TOKEN;
    delete process.env.AI_MODEL;
  }
});

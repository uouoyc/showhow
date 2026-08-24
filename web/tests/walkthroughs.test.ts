import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dataDir = mkdtempSync(join(tmpdir(), "showhow-"));
process.env.DATA_DIR = dataDir;

const { createWalkthrough, findWalkthroughBySlug, listWalkthroughs } =
  await import("../lib/walkthroughs");
const { closeDatabase } = await import("../lib/database");
const { POST } = await import("../app/api/walkthroughs/route");

after(() => {
  closeDatabase();
  rmSync(dataDir, { force: true, recursive: true });
});

test("user can create and list a Walkthrough", () => {
  const walkthrough = createWalkthrough("  First recording  ");

  assert.equal(walkthrough.title, "First recording");
  assert.match(walkthrough.slug, /^[a-f0-9]{12}$/);
  assert.deepEqual(listWalkthroughs(), [walkthrough]);
  assert.deepEqual(findWalkthroughBySlug(walkthrough.slug), walkthrough);
  assert.equal(existsSync(join(dataDir, "showhow.db")), true);
  assert.equal(existsSync(join(dataDir, "screenshots")), true);
});

test("API creates a Walkthrough", async () => {
  const invalidResponse = await POST(
    new Request("http://showhow.test/api/walkthroughs", {
      body: JSON.stringify({ title: "" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
  assert.equal(invalidResponse.status, 400);

  const createResponse = await POST(
    new Request("http://showhow.test/api/walkthroughs", {
      body: JSON.stringify({ title: "API recording" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
  assert.equal(createResponse.status, 201);

  const { walkthrough } = await createResponse.json();
  assert.equal(walkthrough.title, "API recording");
});

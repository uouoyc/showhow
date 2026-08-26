import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const root = mkdtempSync(join(tmpdir(), "showhow-build-"));
const dataDir = join(root, "must-not-exist");
process.env.DATA_DIR = dataDir;
process.env.NEXT_PHASE = "phase-production-build";

const { closeDatabase } = await import("../lib/database");

after(() => {
  closeDatabase();
  delete process.env.DATA_DIR;
  delete process.env.NEXT_PHASE;
  rmSync(root, { force: true, recursive: true });
});

test("production build does not touch DATA_DIR", () => {
  assert.equal(existsSync(dataDir), false);
});

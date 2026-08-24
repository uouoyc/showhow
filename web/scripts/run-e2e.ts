import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "showhow-e2e-"));

try {
  const result = spawnSync(
    process.execPath,
    [join("node_modules", "@playwright", "test", "cli.js"), "test"],
    {
      env: { ...process.env, SHOWHOW_E2E_DATA_DIR: dataDir },
      stdio: "inherit",
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(dataDir, { force: true, recursive: true });
}

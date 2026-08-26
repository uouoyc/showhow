import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "showhow-e2e-"));
const buildDir = join(process.cwd(), ".next-e2e");
rmSync(buildDir, { force: true, recursive: true });

try {
  const result = spawnSync(
    process.execPath,
    [
      join("node_modules", "@playwright", "test", "cli.js"),
      "test",
      ...process.argv.slice(2).filter((argument) => argument !== "--"),
    ],
    {
      env: { ...process.env, SHOWHOW_E2E_DATA_DIR: dataDir },
      stdio: "inherit",
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(dataDir, { force: true, recursive: true });
  rmSync(buildDir, { force: true, recursive: true });
}

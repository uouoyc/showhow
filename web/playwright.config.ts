import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const dataDir = process.env.SHOWHOW_E2E_DATA_DIR;

if (!dataDir) {
  throw new Error("Run Playwright through pnpm test:e2e.");
}

export default defineConfig({
  fullyParallel: false,
  metadata: { dataDir },
  outputDir: join(dataDir, "playwright-results"),
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3100",
    channel: "chrome",
    headless: true,
  },
  webServer: {
    command: "pnpm exec next dev --webpack --port 3100",
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      NEXT_DIST_DIR: ".next-e2e",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://localhost:3100",
  },
  workers: 1,
});

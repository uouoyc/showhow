import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";

test("capture payload persists and completes a public Replay", async ({
  page,
  request,
}, testInfo) => {
  const dataDir = String(testInfo.config.metadata.dataDir);
  const title = `Capture to Replay ${Date.now()}`;
  const createResponse = await request.post("/api/walkthroughs", {
    data: { title },
  });
  expect(createResponse.status()).toBe(201);
  const { walkthrough } = await createResponse.json();
  const captureId = crypto.randomUUID();

  const stepResponse = await request.post(
    `/api/walkthroughs/${walkthrough.id}/steps`,
    {
      data: {
        captureId,
        clickX: 640,
        clickY: 360,
        elementLabel: "button Complete",
        elementRect: { height: 40, width: 120, x: 580, y: 340 },
        pageUrl: "https://example.test/complete",
        screenshotDataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        sequence: 1,
        viewportHeight: 720,
        viewportWidth: 1280,
      },
    },
  );
  expect(stepResponse.status()).toBe(201);
  const { step } = await stepResponse.json();

  expect(existsSync(join(dataDir, "showhow.db"))).toBe(true);
  expect(existsSync(join(dataDir, "screenshots", step.screenshotFile))).toBe(
    true,
  );

  await page.goto(`/w/${walkthrough.slug}`);
  await page.getByRole("button", { name: "Start Walkthrough" }).click();
  await expect(page.getByText("Step 1 of 1")).toBeVisible();
  await page.getByRole("button", { name: "Complete Walkthrough" }).click();
  await expect(page.getByText("Walkthrough complete")).toBeVisible();

  await expect
    .poll(() => {
      const database = new Database(join(dataDir, "showhow.db"), {
        readonly: true,
      });
      const stats = database
        .prepare("select views, completions from walkthroughs where id = ?")
        .get(walkthrough.id) as { completions: number; views: number };
      database.close();
      return stats;
    })
    .toEqual({ completions: 1, views: 1 });
});

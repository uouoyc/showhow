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

  await page.goto("/");
  await page.getByRole("link", { name: `Edit ${title}` }).click();
  await expect(page).toHaveURL(`/edit/${walkthrough.id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const screenshotEditor = page.getByTestId("step-screenshot-editor");
  const editorBounds = await screenshotEditor.boundingBox();
  if (!editorBounds) {
    throw new Error("Step screenshot editor is not visible.");
  }
  await screenshotEditor.click({
    position: {
      x: editorBounds.width * 0.25,
      y: editorBounds.height * 0.75,
    },
  });
  await page.getByRole("button", { name: "Draw redaction" }).click();
  const redactionBounds = await screenshotEditor.boundingBox();
  if (!redactionBounds) {
    throw new Error("Step screenshot editor is not visible.");
  }
  await page.mouse.move(
    redactionBounds.x + redactionBounds.width * 0.1,
    redactionBounds.y + redactionBounds.height * 0.1,
  );
  await page.mouse.down();
  await page.mouse.move(
    redactionBounds.x + redactionBounds.width * 0.3,
    redactionBounds.y + redactionBounds.height * 0.3,
  );
  await page.mouse.up();
  await expect(page.getByTestId("editor-redaction")).toBeVisible();
  const addCenteredRedaction = page.getByRole("button", {
    name: "Add centered redaction",
  });
  await addCenteredRedaction.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("editor-redaction")).toHaveCount(2);
  await page.getByLabel("Redaction 2 X (%)").fill("10");
  await expect(page.getByTestId("editor-redaction").nth(1)).toHaveAttribute(
    "style",
    /left: 10%/,
  );
  const removeSecondRedaction = page.getByRole("button", {
    name: "Remove redaction 2",
  });
  await removeSecondRedaction.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("editor-redaction")).toHaveCount(1);
  await page.getByRole("button", { name: "Save Step" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();

  await page.goto(`/w/${walkthrough.slug}`);
  await page.getByRole("button", { name: "Start Walkthrough" }).click();
  await expect(page.getByText("Step 1 of 1")).toBeVisible();
  const [hotspotLeft, hotspotTop] = await page
    .getByTestId("replay-hotspot")
    .evaluate((element) => [
      Number.parseFloat(element.style.left),
      Number.parseFloat(element.style.top),
    ]);
  expect(Math.abs(hotspotLeft - 25)).toBeLessThan(0.2);
  expect(Math.abs(hotspotTop - 75)).toBeLessThan(0.2);
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

test("editor directory reorders Steps by drag and drop", async ({
  page,
  request,
}) => {
  const createResponse = await request.post("/api/walkthroughs", {
    data: { title: "Drag Step order" },
  });
  const { walkthrough } = await createResponse.json();
  const labels = ["button First", "button Second"];

  for (const [index, elementLabel] of labels.entries()) {
    const response = await request.post(
      `/api/walkthroughs/${walkthrough.id}/steps`,
      {
        data: {
          captureId: crypto.randomUUID(),
          clickX: 10,
          clickY: 10,
          elementLabel,
          elementRect: { height: 20, width: 40, x: 0, y: 0 },
          pageUrl: `https://example.test/${index + 1}`,
          screenshotDataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          sequence: index + 1,
          viewportHeight: 100,
          viewportWidth: 100,
        },
      },
    );
    expect(response.status()).toBe(201);
  }

  await page.goto(`/edit/${walkthrough.id}`);
  const directory = page.getByRole("navigation", { name: "Step directory" });
  const first = directory.getByRole("button", {
    name: "Step 1: button First",
  });
  const second = directory.getByRole("button", {
    name: "Step 2: button Second",
  });
  const firstBounds = await first.boundingBox();
  const secondBounds = await second.boundingBox();
  if (!firstBounds || !secondBounds) {
    throw new Error("Step directory items are not visible.");
  }
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await second.dispatchEvent("dragstart", { dataTransfer });
  await expect(second).toHaveClass(/border-dashed/);
  const clientY = firstBounds.y + firstBounds.height / 2;
  await first.dispatchEvent("dragover", { clientY, dataTransfer });
  const insertLine = page.getByTestId("step-insert-line");
  await expect(insertLine).toBeVisible();
  await expect
    .poll(() =>
      insertLine.evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBe(2);
  await expect
    .poll(() =>
      first.evaluate((element) => {
        const transform = getComputedStyle(
          element.parentElement as HTMLElement,
        ).transform;
        return new DOMMatrix(transform).m42;
      }),
    )
    .not.toBe(0);
  await first.dispatchEvent("drop", { clientY, dataTransfer });
  await second.dispatchEvent("dragend", { dataTransfer });

  await expect(directory.getByRole("button").first()).toHaveAccessibleName(
    "Step 1: button Second",
  );
  await page.reload();
  await expect(directory.getByRole("button").first()).toHaveAccessibleName(
    "Step 1: button Second",
  );
});

test("home imports a portable Walkthrough JSON file", async ({ page }) => {
  const title = "Imported portable Walkthrough";
  await page.goto("/");
  await page.getByLabel("Import Walkthrough JSON").setInputFiles({
    buffer: Buffer.from(
      JSON.stringify({
        formatVersion: 1,
        steps: [
          {
            captureId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            clickX: 50,
            clickY: 50,
            description: "Restore this Step.",
            elementLabel: "button Restore",
            elementRect: { height: 20, width: 40, x: 30, y: 40 },
            pageUrl: "https://example.test/import",
            redactions: [],
            screenshotDataUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            sequence: 1,
            title: "Restore",
            viewportHeight: 100,
            viewportWidth: 100,
          },
        ],
        walkthrough: { ctaUrl: null, slug: "ignored", title },
      }),
    ),
    mimeType: "application/json",
    name: "walkthrough.json",
  });
  await page
    .getByRole("button", { name: "Import Walkthrough", exact: true })
    .click();
  await expect(page).toHaveURL(/\/edit\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

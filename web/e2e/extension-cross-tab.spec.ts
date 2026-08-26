import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";

type ExtensionChrome = {
  storage: {
    local: {
      get(
        key: string | string[],
        callback: (values: Record<string, unknown>) => void,
      ): void;
    };
  };
};

test("Recording follows clicks across active tabs in its browser window", async ({
  browserName: _browserName,
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const extensionPath = resolve(process.cwd(), "../extension");
  const userDataDir = mkdtempSync(join(tmpdir(), "showhow-extension-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    channel: "chromium",
    headless: true,
  });

  try {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent("serviceworker");
    const extensionId = worker.url().split("/")[2];
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.locator("#server-url").fill(baseURL);
    await popup.locator("#title").fill("Cross-tab Recording");
    const tabA = await context.newPage();
    await tabA.goto(baseURL);
    const tabB = await context.newPage();
    await tabB.goto(baseURL);
    await tabA.bringToFront();
    await popup
      .locator("#start-form")
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(popup.locator("#recording")).toBeVisible();

    async function expectStepCount(count: number) {
      await expect
        .poll(() =>
          worker.evaluate(() => {
            const chrome = (
              globalThis as typeof globalThis & {
                chrome: ExtensionChrome;
              }
            ).chrome;
            return new Promise<{
              captureError: unknown;
              stepCount: number | undefined;
            }>((resolve) =>
              chrome.storage.local.get(
                ["captureError", "recording"],
                ({ captureError, recording }) =>
                  resolve({
                    captureError,
                    stepCount: (recording as { stepCount?: number } | undefined)
                      ?.stepCount,
                  }),
              ),
            );
          }),
        )
        .toEqual({ captureError: undefined, stepCount: count });
    }

    await expectStepCount(0);
    await tabA
      .getByRole("button", { name: "Import Walkthrough", exact: true })
      .click();
    await expectStepCount(1);
    await tabB.bringToFront();
    await tabB
      .getByRole("button", { name: "Import Walkthrough", exact: true })
      .click();
    await expectStepCount(2);

    const editorPagePromise = context.waitForEvent("page");
    await popup
      .locator("#stop")
      .evaluate((button: HTMLButtonElement) => button.click());
    const editorPage = await editorPagePromise;
    await editorPage.waitForURL(/\/edit\//);
    await expect(
      editorPage
        .getByRole("navigation", { name: "Step directory" })
        .getByRole("button"),
    ).toHaveCount(2);
  } finally {
    await context.close();
    rmSync(userDataDir, { force: true, recursive: true });
  }
});

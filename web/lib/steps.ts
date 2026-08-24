import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { type Step, steps } from "@/db/schema";
import { db, screenshotsDir } from "@/lib/database";

export type StepCapture = {
  captureId: string;
  clickX: number;
  clickY: number;
  elementLabel: string;
  elementRect: { height: number; width: number; x: number; y: number };
  pageUrl: string;
  screenshotDataUrl: string;
  sequence: number;
  viewportHeight: number;
  viewportWidth: number;
};

export class InvalidStepCaptureError extends Error {}

export function createStep(walkthroughId: string, capture: StepCapture): Step {
  const existing = db
    .select()
    .from(steps)
    .where(
      and(
        eq(steps.walkthroughId, walkthroughId),
        eq(steps.captureId, capture.captureId),
      ),
    )
    .get();

  if (existing) {
    return existing;
  }

  const screenshot = /^data:image\/(png|jpeg);base64,([a-z0-9+/=]+)$/i.exec(
    capture.screenshotDataUrl,
  );

  if (!screenshot || !/^[a-f0-9-]{36}$/i.test(capture.captureId)) {
    throw new InvalidStepCaptureError();
  }

  const extension = screenshot[1] === "jpeg" ? "jpg" : "png";
  const screenshotFile = `${capture.captureId}.${extension}`;
  const bytes = Buffer.from(screenshot[2], "base64");

  if (bytes.length === 0 || bytes.length > 15 * 1024 * 1024) {
    throw new InvalidStepCaptureError();
  }

  const screenshotPath = join(
    /* turbopackIgnore: true */ screenshotsDir,
    screenshotFile,
  );

  try {
    writeFileSync(screenshotPath, bytes, { flag: "wx" });
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code !== "EEXIST") {
      throw error;
    }
    if (!readFileSync(screenshotPath).equals(bytes)) {
      throw new InvalidStepCaptureError();
    }
  }

  return db
    .insert(steps)
    .values({
      id: randomUUID(),
      walkthroughId,
      captureId: capture.captureId,
      sequence: capture.sequence,
      screenshotFile,
      pageUrl: capture.pageUrl,
      elementLabel: capture.elementLabel,
      clickX: capture.clickX,
      clickY: capture.clickY,
      viewportWidth: capture.viewportWidth,
      viewportHeight: capture.viewportHeight,
      rectX: capture.elementRect.x,
      rectY: capture.elementRect.y,
      rectWidth: capture.elementRect.width,
      rectHeight: capture.elementRect.height,
      createdAt: new Date(),
    })
    .returning()
    .get();
}

export function listSteps(walkthroughId: string): Step[] {
  return db
    .select()
    .from(steps)
    .where(eq(steps.walkthroughId, walkthroughId))
    .orderBy(asc(steps.sequence))
    .all();
}

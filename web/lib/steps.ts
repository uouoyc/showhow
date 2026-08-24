import { randomUUID } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq, gt, sql } from "drizzle-orm";
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
export class InvalidStepContentError extends Error {}

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
      title: capture.elementLabel,
      description: capture.elementLabel,
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

export function updateStep(
  walkthroughId: string,
  stepId: string,
  input: { description: unknown; title: unknown },
): Step | undefined {
  if (
    typeof input.title !== "string" ||
    input.title.trim().length === 0 ||
    input.title.length > 120 ||
    typeof input.description !== "string" ||
    input.description.length > 2000
  ) {
    throw new InvalidStepContentError();
  }

  return db
    .update(steps)
    .set({ description: input.description.trim(), title: input.title.trim() })
    .where(and(eq(steps.walkthroughId, walkthroughId), eq(steps.id, stepId)))
    .returning()
    .get();
}

export function moveStep(
  walkthroughId: string,
  stepId: string,
  direction: "down" | "up",
): Step | undefined {
  const current = db
    .select()
    .from(steps)
    .where(and(eq(steps.walkthroughId, walkthroughId), eq(steps.id, stepId)))
    .get();

  if (!current) {
    return undefined;
  }

  const targetSequence = current.sequence + (direction === "up" ? -1 : 1);
  const adjacent = db
    .select()
    .from(steps)
    .where(
      and(
        eq(steps.walkthroughId, walkthroughId),
        eq(steps.sequence, targetSequence),
      ),
    )
    .get();

  if (!adjacent) {
    return current;
  }

  return db.transaction((transaction) => {
    transaction
      .update(steps)
      .set({ sequence: 0 })
      .where(eq(steps.id, current.id))
      .run();
    transaction
      .update(steps)
      .set({ sequence: current.sequence })
      .where(eq(steps.id, adjacent.id))
      .run();
    return transaction
      .update(steps)
      .set({ sequence: adjacent.sequence })
      .where(eq(steps.id, current.id))
      .returning()
      .get();
  });
}

export function deleteStep(walkthroughId: string, stepId: string): boolean {
  const step = db
    .select()
    .from(steps)
    .where(and(eq(steps.walkthroughId, walkthroughId), eq(steps.id, stepId)))
    .get();

  if (!step) {
    return false;
  }

  db.transaction((transaction) => {
    transaction.delete(steps).where(eq(steps.id, step.id)).run();
    transaction
      .update(steps)
      .set({ sequence: sql`${steps.sequence} - 1` })
      .where(
        and(
          eq(steps.walkthroughId, walkthroughId),
          gt(steps.sequence, step.sequence),
        ),
      )
      .run();
  });

  try {
    unlinkSync(join(screenshotsDir, step.screenshotFile));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Unable to remove orphaned Step screenshot.", error);
    }
  }
  return true;
}

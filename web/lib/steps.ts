import { randomUUID } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { type Redaction, type Step, steps } from "@/db/schema";
import { db, screenshotsDir } from "@/lib/database";
import { decodeScreenshotDataUrl } from "@/lib/screenshots";

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
export class InvalidStepOrderError extends Error {}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseStepCapture(value: unknown): StepCapture | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const capture = value as Record<string, unknown>;
  const rect = capture.elementRect;
  if (typeof rect !== "object" || rect === null) {
    return undefined;
  }
  const elementRect = rect as Record<string, unknown>;
  if (
    ![
      capture.clickX,
      capture.clickY,
      elementRect.height,
      elementRect.width,
      elementRect.x,
      elementRect.y,
    ].every(isFiniteNumber) ||
    !Number.isInteger(capture.sequence) ||
    Number(capture.sequence) < 1 ||
    !Number.isInteger(capture.viewportHeight) ||
    Number(capture.viewportHeight) < 1 ||
    !Number.isInteger(capture.viewportWidth) ||
    Number(capture.viewportWidth) < 1 ||
    Number(capture.clickX) < 0 ||
    Number(capture.clickX) > Number(capture.viewportWidth) ||
    Number(capture.clickY) < 0 ||
    Number(capture.clickY) > Number(capture.viewportHeight) ||
    Number(elementRect.height) < 0 ||
    Number(elementRect.width) < 0 ||
    typeof capture.captureId !== "string" ||
    typeof capture.elementLabel !== "string" ||
    capture.elementLabel.trim().length === 0 ||
    capture.elementLabel.length > 160 ||
    typeof capture.pageUrl !== "string" ||
    typeof capture.screenshotDataUrl !== "string"
  ) {
    return undefined;
  }
  try {
    const pageUrl = new URL(capture.pageUrl);
    if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return {
    captureId: capture.captureId,
    clickX: Number(capture.clickX),
    clickY: Number(capture.clickY),
    elementLabel: capture.elementLabel.trim(),
    elementRect: {
      height: Number(elementRect.height),
      width: Number(elementRect.width),
      x: Number(elementRect.x),
      y: Number(elementRect.y),
    },
    pageUrl: capture.pageUrl,
    screenshotDataUrl: capture.screenshotDataUrl,
    sequence: Number(capture.sequence),
    viewportHeight: Number(capture.viewportHeight),
    viewportWidth: Number(capture.viewportWidth),
  };
}

export function isValidRedactions(value: unknown): value is Redaction[] {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every((redaction: unknown) => {
      if (typeof redaction !== "object" || redaction === null) {
        return false;
      }
      const { height, width, x, y } = redaction as Record<string, unknown>;
      return (
        [height, width, x, y].every(
          (number) => typeof number === "number" && Number.isFinite(number),
        ) &&
        Number(height) > 0 &&
        Number(width) > 0 &&
        Number(x) >= 0 &&
        Number(y) >= 0 &&
        Number(x) + Number(width) <= 1 &&
        Number(y) + Number(height) <= 1
      );
    })
  );
}

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

  const screenshot = decodeScreenshotDataUrl(capture.screenshotDataUrl);

  if (
    !screenshot ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      capture.captureId,
    )
  ) {
    throw new InvalidStepCaptureError();
  }

  const screenshotFile = `${walkthroughId}_${capture.captureId.toLowerCase()}.${screenshot.extension}`;
  const { bytes } = screenshot;

  const screenshotPath = join(
    /* turbopackIgnore: true */ screenshotsDir,
    screenshotFile,
  );
  let createdScreenshot = false;

  try {
    writeFileSync(screenshotPath, bytes, { flag: "wx" });
    createdScreenshot = true;
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code !== "EEXIST") {
      throw error;
    }
    if (!readFileSync(screenshotPath).equals(bytes)) {
      throw new InvalidStepCaptureError();
    }
  }

  try {
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
  } catch (error) {
    if (createdScreenshot) {
      try {
        unlinkSync(screenshotPath);
      } catch (cleanupError) {
        console.error(
          "Unable to remove orphaned Step screenshot.",
          cleanupError,
        );
      }
    }
    throw error;
  }
}

export function listSteps(walkthroughId: string): Step[] {
  return db
    .select()
    .from(steps)
    .where(eq(steps.walkthroughId, walkthroughId))
    .orderBy(asc(steps.sequence))
    .all();
}

export function findStepByScreenshotFile(
  screenshotFile: string,
): Step | undefined {
  return db
    .select()
    .from(steps)
    .where(eq(steps.screenshotFile, screenshotFile))
    .get();
}

export function updateStep(
  walkthroughId: string,
  stepId: string,
  input: {
    clickX: unknown;
    clickY: unknown;
    description: unknown;
    redactions: unknown;
    title: unknown;
  },
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

  const current = db
    .select()
    .from(steps)
    .where(and(eq(steps.walkthroughId, walkthroughId), eq(steps.id, stepId)))
    .get();
  if (!current) {
    return undefined;
  }

  const { clickX, clickY, redactions } = input;
  if (
    typeof clickX !== "number" ||
    !Number.isFinite(clickX) ||
    clickX < 0 ||
    clickX > current.viewportWidth ||
    typeof clickY !== "number" ||
    !Number.isFinite(clickY) ||
    clickY < 0 ||
    clickY > current.viewportHeight ||
    !isValidRedactions(redactions)
  ) {
    throw new InvalidStepContentError();
  }

  return db
    .update(steps)
    .set({
      clickX,
      clickY,
      description: input.description.trim(),
      redactions,
      title: input.title.trim(),
    })
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

export function reorderSteps(walkthroughId: string, stepIds: string[]): Step[] {
  const current = listSteps(walkthroughId);
  const currentIds = new Set(current.map((step) => step.id));

  if (
    stepIds.length !== current.length ||
    new Set(stepIds).size !== stepIds.length ||
    stepIds.some((stepId) => !currentIds.has(stepId))
  ) {
    throw new InvalidStepOrderError();
  }

  db.transaction((transaction) => {
    transaction
      .update(steps)
      .set({ sequence: sql`-${steps.sequence}` })
      .where(eq(steps.walkthroughId, walkthroughId))
      .run();

    for (const [index, stepId] of stepIds.entries()) {
      transaction
        .update(steps)
        .set({ sequence: index + 1 })
        .where(
          and(eq(steps.walkthroughId, walkthroughId), eq(steps.id, stepId)),
        )
        .run();
    }
  });

  return listSteps(walkthroughId);
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

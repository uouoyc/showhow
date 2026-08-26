import { eq } from "drizzle-orm";
import { type Redaction, walkthroughs } from "@/db/schema";
import { db } from "@/lib/database";
import { maxPortableSteps } from "@/lib/portable-limits";
import {
  isDecodableScreenshotDataUrl,
  renderStepScreenshot,
} from "@/lib/screenshots";
import {
  createStep,
  deleteStep,
  isValidRedactions,
  listSteps,
  parseStepCapture,
  type StepCapture,
  updateStep,
} from "@/lib/steps";
import {
  createWalkthrough,
  findWalkthroughById,
  updateWalkthrough,
} from "@/lib/walkthroughs";

export class InvalidPortableWalkthroughError extends Error {}
export class PortableWalkthroughTooLargeError extends Error {}

export async function exportWalkthrough(walkthroughId: string) {
  const walkthrough = findWalkthroughById(walkthroughId);

  if (!walkthrough) {
    return undefined;
  }

  return {
    formatVersion: 1 as const,
    walkthrough: {
      ctaUrl: walkthrough.ctaUrl,
      slug: walkthrough.slug,
      title: walkthrough.title,
    },
    steps: await Promise.all(
      listSteps(walkthroughId).map(async (step) => ({
        captureId: step.captureId,
        clickX: step.clickX,
        clickY: step.clickY,
        description: step.description,
        elementLabel: step.elementLabel,
        elementRect: {
          height: step.rectHeight,
          width: step.rectWidth,
          x: step.rectX,
          y: step.rectY,
        },
        pageUrl: step.pageUrl,
        redactions: step.redactions,
        screenshotDataUrl: `data:image/${step.screenshotFile.endsWith(".png") ? "png" : "jpeg"};base64,${(await renderStepScreenshot(step)).toString("base64")}`,
        sequence: step.sequence,
        title: step.title,
        viewportHeight: step.viewportHeight,
        viewportWidth: step.viewportWidth,
      })),
    ),
  };
}

type PortableStep = StepCapture & {
  description: string;
  redactions: Redaction[];
  title: string;
};

function portableStep(value: unknown, sequence: number): PortableStep {
  if (typeof value !== "object" || value === null) {
    throw new InvalidPortableWalkthroughError();
  }
  const step = value as Record<string, unknown>;
  const capture = parseStepCapture(value);
  if (
    !capture ||
    capture.sequence !== sequence ||
    typeof step.title !== "string" ||
    step.title.trim().length === 0 ||
    step.title.length > 120 ||
    typeof step.description !== "string" ||
    step.description.length > 2000 ||
    !isValidRedactions(step.redactions)
  ) {
    throw new InvalidPortableWalkthroughError();
  }
  return {
    ...capture,
    description: step.description,
    redactions: step.redactions,
    title: step.title,
  };
}

export async function importWalkthrough(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("formatVersion" in value) ||
    value.formatVersion !== 1 ||
    !("walkthrough" in value) ||
    typeof value.walkthrough !== "object" ||
    value.walkthrough === null ||
    !("steps" in value) ||
    !Array.isArray(value.steps)
  ) {
    throw new InvalidPortableWalkthroughError();
  }
  if (value.steps.length > maxPortableSteps) {
    throw new PortableWalkthroughTooLargeError();
  }

  const portableWalkthrough = value.walkthrough as Record<string, unknown>;
  if (
    typeof portableWalkthrough.title !== "string" ||
    portableWalkthrough.title.trim().length === 0 ||
    portableWalkthrough.title.length > 120 ||
    (portableWalkthrough.ctaUrl !== null &&
      typeof portableWalkthrough.ctaUrl !== "string")
  ) {
    throw new InvalidPortableWalkthroughError();
  }
  const portableSteps = value.steps.map((step, index) =>
    portableStep(step, index + 1),
  );
  if (
    new Set(portableSteps.map((step) => step.captureId)).size !==
    portableSteps.length
  ) {
    throw new InvalidPortableWalkthroughError();
  }
  for (const step of portableSteps) {
    if (!(await isDecodableScreenshotDataUrl(step.screenshotDataUrl))) {
      throw new InvalidPortableWalkthroughError();
    }
  }
  const walkthrough = createWalkthrough(portableWalkthrough.title);

  try {
    updateWalkthrough(walkthrough.id, {
      ctaUrl: portableWalkthrough.ctaUrl,
      title: portableWalkthrough.title,
    });
    for (const step of portableSteps) {
      const created = createStep(walkthrough.id, step);
      updateStep(walkthrough.id, created.id, {
        clickX: step.clickX,
        clickY: step.clickY,
        description: step.description,
        redactions: step.redactions,
        title: step.title,
      });
    }
  } catch (error) {
    for (const step of listSteps(walkthrough.id).reverse()) {
      deleteStep(walkthrough.id, step.id);
    }
    db.delete(walkthroughs).where(eq(walkthroughs.id, walkthrough.id)).run();
    if (error instanceof InvalidPortableWalkthroughError) {
      throw error;
    }
    throw new InvalidPortableWalkthroughError();
  }

  return {
    steps: listSteps(walkthrough.id),
    walkthrough: findWalkthroughById(walkthrough.id),
  };
}

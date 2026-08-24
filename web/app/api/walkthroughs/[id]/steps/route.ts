import {
  createStep,
  InvalidStepCaptureError,
  type StepCapture,
} from "@/lib/steps";
import { findWalkthroughById } from "@/lib/walkthroughs";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseCapture(value: unknown): StepCapture | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const capture = value as Record<string, unknown>;
  const rect = capture.elementRect;

  if (typeof rect !== "object" || rect === null) {
    return undefined;
  }

  const elementRect = rect as Record<string, unknown>;
  const numbers = [
    capture.clickX,
    capture.clickY,
    capture.viewportHeight,
    capture.viewportWidth,
    elementRect.height,
    elementRect.width,
    elementRect.x,
    elementRect.y,
  ];

  if (
    !numbers.every(isFiniteNumber) ||
    !Number.isInteger(capture.sequence) ||
    Number(capture.sequence) < 1 ||
    Number(capture.viewportHeight) < 1 ||
    Number(capture.viewportWidth) < 1 ||
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!findWalkthroughById(id)) {
    return Response.json({ error: "Walkthrough not found." }, { status: 404 });
  }

  try {
    const capture = parseCapture(await request.json());

    if (!capture) {
      return Response.json({ error: "Invalid Step capture." }, { status: 400 });
    }

    return Response.json({ step: createStep(id, capture) }, { status: 201 });
  } catch (error) {
    if (
      error instanceof InvalidStepCaptureError ||
      error instanceof SyntaxError
    ) {
      return Response.json({ error: "Invalid Step capture." }, { status: 400 });
    }

    return Response.json({ error: "Unable to store Step." }, { status: 500 });
  }
}

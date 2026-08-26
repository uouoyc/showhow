import {
  createStep,
  InvalidStepCaptureError,
  parseStepCapture,
} from "@/lib/steps";
import { findWalkthroughById } from "@/lib/walkthroughs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!findWalkthroughById(id)) {
    return Response.json({ error: "Walkthrough not found." }, { status: 404 });
  }

  try {
    const capture = parseStepCapture(await request.json());

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

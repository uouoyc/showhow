import { InvalidStepOrderError, reorderSteps } from "@/lib/steps";
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
    const body: unknown = await request.json();
    const stepIds =
      typeof body === "object" && body !== null && "stepIds" in body
        ? body.stepIds
        : undefined;

    if (
      !Array.isArray(stepIds) ||
      !stepIds.every((stepId): stepId is string => typeof stepId === "string")
    ) {
      throw new InvalidStepOrderError();
    }

    return Response.json({ steps: reorderSteps(id, stepIds) });
  } catch (error) {
    if (
      error instanceof InvalidStepOrderError ||
      error instanceof SyntaxError
    ) {
      return Response.json({ error: "Invalid Step order." }, { status: 400 });
    }
    return Response.json(
      { error: "Unable to reorder Steps." },
      { status: 500 },
    );
  }
}

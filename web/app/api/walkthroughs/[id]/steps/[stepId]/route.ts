import { deleteStep, InvalidStepContentError, updateStep } from "@/lib/steps";

type StepParams = { params: Promise<{ id: string; stepId: string }> };

export async function PATCH(request: Request, { params }: StepParams) {
  const { id, stepId } = await params;

  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return Response.json({ error: "Invalid Step." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const step = updateStep(id, stepId, {
      clickX: input.clickX,
      clickY: input.clickY,
      description: input.description,
      redactions: input.redactions,
      title: input.title,
    });

    return step
      ? Response.json({ step })
      : Response.json({ error: "Step not found." }, { status: 404 });
  } catch (error) {
    if (
      error instanceof InvalidStepContentError ||
      error instanceof SyntaxError
    ) {
      return Response.json({ error: "Invalid Step." }, { status: 400 });
    }
    return Response.json({ error: "Unable to save Step." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: StepParams) {
  const { id, stepId } = await params;
  return deleteStep(id, stepId)
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Step not found." }, { status: 404 });
}

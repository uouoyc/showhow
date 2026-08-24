import { moveStep } from "@/lib/steps";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const { id, stepId } = await params;

  try {
    const body: unknown = await request.json();
    const direction =
      typeof body === "object" && body !== null && "direction" in body
        ? body.direction
        : undefined;

    if (direction !== "up" && direction !== "down") {
      return Response.json({ error: "Invalid move." }, { status: 400 });
    }

    const step = moveStep(id, stepId, direction);
    return step
      ? Response.json({ step })
      : Response.json({ error: "Step not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid move." }, { status: 400 });
    }
    return Response.json({ error: "Unable to move Step." }, { status: 500 });
  }
}

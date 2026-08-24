import { recordCompletion, recordView } from "@/lib/stats";
import { findWalkthroughById } from "@/lib/walkthroughs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const walkthrough = findWalkthroughById(id);

  if (!walkthrough) {
    return Response.json({ error: "Walkthrough not found." }, { status: 404 });
  }

  try {
    const body: unknown = await request.json();
    const event =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : undefined;

    if (event?.type === "view") {
      recordView(walkthrough.id);
      return new Response(null, { status: 204 });
    }
    if (
      event?.type === "completion" &&
      typeof event.completionId === "string" &&
      recordCompletion(walkthrough.id, event.completionId)
    ) {
      return new Response(null, { status: 204 });
    }

    return Response.json({ error: "Invalid stats event." }, { status: 400 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid stats event." }, { status: 400 });
    }
    return Response.json({ error: "Unable to record stats." }, { status: 500 });
  }
}

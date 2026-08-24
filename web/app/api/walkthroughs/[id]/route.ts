import {
  InvalidWalkthroughCtaError,
  InvalidWalkthroughTitleError,
  updateWalkthrough,
} from "@/lib/walkthroughs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return Response.json({ error: "Invalid Walkthrough." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const walkthrough = updateWalkthrough(id, {
      ctaUrl: input.ctaUrl,
      title: input.title,
    });

    return walkthrough
      ? Response.json({ walkthrough })
      : Response.json({ error: "Walkthrough not found." }, { status: 404 });
  } catch (error) {
    if (
      error instanceof InvalidWalkthroughCtaError ||
      error instanceof InvalidWalkthroughTitleError ||
      error instanceof SyntaxError
    ) {
      return Response.json({ error: "Invalid Walkthrough." }, { status: 400 });
    }
    return Response.json(
      { error: "Unable to save Walkthrough." },
      { status: 500 },
    );
  }
}

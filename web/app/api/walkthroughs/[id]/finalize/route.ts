import { finalizeWalkthrough, WalkthroughNotFoundError } from "@/lib/drafting";
import { createDescriptionDraftProvider } from "@/lib/responses";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    return Response.json(
      await finalizeWalkthrough(id, createDescriptionDraftProvider()),
    );
  } catch (error) {
    if (error instanceof WalkthroughNotFoundError) {
      return Response.json(
        { error: "Walkthrough not found." },
        { status: 404 },
      );
    }
    return Response.json(
      { error: "Unable to finalize Walkthrough." },
      { status: 500 },
    );
  }
}

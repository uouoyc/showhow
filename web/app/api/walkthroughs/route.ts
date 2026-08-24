import {
  createWalkthrough,
  InvalidWalkthroughTitleError,
} from "@/lib/walkthroughs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const title =
      typeof body === "object" && body !== null && "title" in body
        ? body.title
        : undefined;
    const walkthrough = createWalkthrough(title);

    return Response.json({ walkthrough }, { status: 201 });
  } catch (error) {
    if (
      error instanceof InvalidWalkthroughTitleError ||
      error instanceof SyntaxError
    ) {
      return Response.json(
        { error: "Title must be between 1 and 120 characters." },
        { status: 400 },
      );
    }

    return Response.json(
      { error: "Unable to create Walkthrough." },
      { status: 500 },
    );
  }
}

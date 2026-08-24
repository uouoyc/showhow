import { exportWalkthrough } from "@/lib/export";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const exported = exportWalkthrough(id);

  if (!exported) {
    return Response.json({ error: "Walkthrough not found." }, { status: 404 });
  }

  return Response.json(exported, {
    headers: {
      "content-disposition": `attachment; filename="${exported.walkthrough.slug}.json"`,
    },
  });
}

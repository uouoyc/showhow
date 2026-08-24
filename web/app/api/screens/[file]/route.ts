import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { screenshotsDir } from "@/lib/database";

const screenshotName = /^[a-f0-9-]{36}\.(png|jpg)$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  if (!screenshotName.test(file)) {
    return new Response(null, { status: 404 });
  }

  try {
    const image = await readFile(join(screenshotsDir, file));
    const headers: Record<string, string> = {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": file.endsWith(".png") ? "image/png" : "image/jpeg",
    };
    if (new URL(request.url).searchParams.get("download") === "1") {
      headers["content-disposition"] = `attachment; filename="${file}"`;
    }
    return new Response(image, { headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}

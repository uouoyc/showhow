import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { screenshotsDir } from "@/lib/database";

const screenshotName = /^[a-f0-9-]{36}\.(png|jpg)$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  if (!screenshotName.test(file)) {
    return new Response(null, { status: 404 });
  }

  try {
    const image = await readFile(join(screenshotsDir, file));
    return new Response(image, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": file.endsWith(".png") ? "image/png" : "image/jpeg",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

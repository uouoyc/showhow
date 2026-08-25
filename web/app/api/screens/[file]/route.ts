import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { screenshotsDir } from "@/lib/database";

const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const screenshotName = new RegExp(`^${uuid}_${uuid}\\.(png|jpg)$`, "i");

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
      "content-type": file.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg",
      "x-content-type-options": "nosniff",
    };
    if (new URL(request.url).searchParams.get("download") === "1") {
      headers["content-disposition"] = `attachment; filename="${file}"`;
    }
    return new Response(image, { headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response(null, { status: 404 });
    }
    console.error("Unable to read Step screenshot.", error);
    return new Response(null, { status: 500 });
  }
}

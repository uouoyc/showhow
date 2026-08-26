import { renderStepScreenshot } from "@/lib/screenshots";
import { findStepByScreenshotFile } from "@/lib/steps";

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
    const step = findStepByScreenshotFile(file);
    if (!step) {
      return new Response(null, { status: 404 });
    }
    const image = await renderStepScreenshot(step);
    const headers: Record<string, string> = {
      "cache-control": "no-store",
      "content-type": file.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg",
      "x-content-type-options": "nosniff",
    };
    if (new URL(request.url).searchParams.get("download") === "1") {
      headers["content-disposition"] = `attachment; filename="${file}"`;
    }
    return new Response(Uint8Array.from(image), { headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response(null, { status: 404 });
    }
    console.error("Unable to read Step screenshot.", error);
    return new Response(null, { status: 500 });
  }
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { Step } from "@/db/schema";
import { screenshotsDir } from "@/lib/database";

const maxScreenshotBytes = 15 * 1024 * 1024;
const maxScreenshotDataUrlLength = Math.ceil(maxScreenshotBytes / 3) * 4 + 32;

function hasScreenshotSignature(bytes: Buffer, type: string): boolean {
  return type === "png"
    ? bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    : bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
}

export function decodeScreenshotDataUrl(
  value: string,
): { bytes: Buffer; extension: "jpg" | "png" } | undefined {
  const screenshot =
    value.length <= maxScreenshotDataUrlLength
      ? /^data:image\/(png|jpeg);base64,([a-z0-9+/=]+)$/i.exec(value)
      : null;
  if (!screenshot) {
    return undefined;
  }
  const type = screenshot[1].toLowerCase();
  const bytes = Buffer.from(screenshot[2], "base64");
  if (
    bytes.length === 0 ||
    bytes.length > maxScreenshotBytes ||
    !hasScreenshotSignature(bytes, type)
  ) {
    return undefined;
  }
  return { bytes, extension: type === "jpeg" ? "jpg" : "png" };
}

export async function isDecodableScreenshotDataUrl(
  value: string,
): Promise<boolean> {
  const screenshot = decodeScreenshotDataUrl(value);
  if (!screenshot) {
    return false;
  }
  try {
    const { info } = await sharp(screenshot.bytes)
      .raw()
      .toBuffer({ resolveWithObject: true });
    return info.width > 0 && info.height > 0;
  } catch {
    return false;
  }
}

export async function renderStepScreenshot(step: Step): Promise<Buffer> {
  const screenshot = await readFile(join(screenshotsDir, step.screenshotFile));
  if (step.redactions.length === 0) {
    return screenshot;
  }

  const image = sharp(screenshot);
  const { height, width } = await image.metadata();
  if (!height || !width) {
    throw new Error("Step screenshot dimensions are unavailable.");
  }

  const rectangles = step.redactions
    .map((redaction) => {
      const x = Math.floor(redaction.x * width);
      const y = Math.floor(redaction.y * height);
      const rectangleWidth = Math.max(
        1,
        Math.ceil((redaction.x + redaction.width) * width) - x,
      );
      const rectangleHeight = Math.max(
        1,
        Math.ceil((redaction.y + redaction.height) * height) - y,
      );
      return `<rect x="${x}" y="${y}" width="${rectangleWidth}" height="${rectangleHeight}" fill="black"/>`;
    })
    .join("");

  return image
    .composite([
      {
        input: Buffer.from(
          `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rectangles}</svg>`,
        ),
      },
    ])
    .toBuffer();
}

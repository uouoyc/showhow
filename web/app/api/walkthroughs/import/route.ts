import { maxPortableImportBytes } from "@/lib/portable-limits";
import {
  InvalidPortableWalkthroughError,
  importWalkthrough,
  PortableWalkthroughTooLargeError,
} from "@/lib/portable-walkthrough";

class PortableImportTooLargeError extends Error {}

async function readPortableJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > maxPortableImportBytes
  ) {
    throw new PortableImportTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new SyntaxError("Missing request body.");
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.byteLength;
    if (length > maxPortableImportBytes) {
      void reader.cancel();
      throw new PortableImportTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

export async function POST(request: Request) {
  try {
    return Response.json(
      await importWalkthrough(await readPortableJson(request)),
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof PortableImportTooLargeError ||
      error instanceof PortableWalkthroughTooLargeError
    ) {
      return Response.json(
        { error: "Showhow export is too large." },
        { status: 413 },
      );
    }
    if (
      error instanceof InvalidPortableWalkthroughError ||
      error instanceof SyntaxError
    ) {
      return Response.json(
        { error: "Invalid Showhow export." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "Unable to import Walkthrough." },
      { status: 500 },
    );
  }
}

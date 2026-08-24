import OpenAI from "openai";
import type { DescriptionDraftProvider } from "@/lib/drafting";

export function createDescriptionDraftProvider():
  | DescriptionDraftProvider
  | undefined {
  const token = process.env.AI_TOKEN;

  if (!token) {
    return undefined;
  }

  const client = new OpenAI({
    apiKey: token,
    baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  });
  const model = process.env.AI_MODEL || "gpt-5-mini";

  return async (steps) => {
    const response = await client.responses.create({
      input: JSON.stringify(steps),
      instructions:
        "Return JSON with a steps array. Draft one concise imperative description per input Step and preserve every captureId exactly. Each item must contain only captureId and description.",
      model,
    });
    const result: unknown = JSON.parse(response.output_text);

    if (
      typeof result !== "object" ||
      result === null ||
      !("steps" in result) ||
      !Array.isArray(result.steps)
    ) {
      throw new Error("Invalid Responses API output.");
    }

    return result.steps as Array<{ captureId: string; description: string }>;
  };
}

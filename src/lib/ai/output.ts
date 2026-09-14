import { z } from "zod";
import type { AIFeature } from "@/lib/ai/types";
import { AIOutputError } from "@/lib/ai/types";

export const OUTPUT_SCHEMAS = {
  captions: z.object({ caption: z.string().min(1) }),
  hashtags: z.object({ hashtags: z.array(z.string().min(1)).min(1) }),
  cta: z.object({ cta: z.string().min(1) }),
  ideas: z.object({
    ideas: z
      .array(
        z.object({
          title: z.string().min(1),
          description: z.string().min(1),
          format: z.string().optional(),
        })
      )
      .min(1),
  }),
  rewrite: z.object({ rewritten: z.string().min(1) }),
  tone: z.object({ rewritten: z.string().min(1) }),
};

export function extractStructuredJSON(text: string, feature: AIFeature): unknown {
  const schema = OUTPUT_SCHEMAS[feature];
  if (!schema) return { text };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AIOutputError("The AI provider returned invalid JSON. Please try again.");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AIOutputError("The AI output did not match the expected format. Please try again.");
  }
  return result.data;
}
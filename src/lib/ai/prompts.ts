import type { AIFeature, AILength, AITone } from "@/lib/ai/types";

export interface GenerateOptions {
  feature: AIFeature;
  content?: string;
  tone?: AITone;
  platform?: string;
  length?: AILength;
  count?: number;
}

const LENGTH_HINT: Record<AILength, string> = {
  short: "Keep it tight: 1–2 sentences where possible.",
  medium: "Aim for a solid, standard-length post.",
  long: "Feel free to be expansive, but keep it readable.",
};

function platformLabel(platform?: string): string {
  if (!platform) return "social media";
  const labels: Record<string, string> = {
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook",
    TIKTOK: "TikTok",
    LINKEDIN: "LinkedIn",
    X: "X (Twitter)",
    YOUTUBE: "YouTube",
  };
  return labels[platform] ?? "social media";
}

export function buildPrompt(opts: GenerateOptions): string {
  const platform = platformLabel(opts.platform);
  const lengthHint = opts.length ? LENGTH_HINT[opts.length] : "";
  const toneHint = opts.tone ? `Use a ${opts.tone} tone.` : "";
  const countHint = opts.count && opts.count > 1 ? `Produce ${opts.count} distinct options, clearly separated with numbered lines "1.", "2.", ...` : "";
  const source = opts.content?.trim();

  const parts: string[] = [
    "You are a senior social media copywriter embedded in ZELVOA. Write ready-to-post content for the requested platform. Be concrete, avoid fluff, and never invent brand claims, metrics, or links. If the user references a brand or product, keep the persona generic unless they provided details.",
    `Generate content for ${platform}. ${toneHint} ${lengthHint} ${countHint}`.trim(),
  ];

  switch (opts.feature) {
    case "captions":
      parts.push("Purpose: a platform-native caption for the content described below.");
      break;
    case "hashtags":
      parts.push(
        "Purpose: a curated set of relevant hashtags (keep 8–15, mix of sizes) formatted as a simple space-separated list, plus at most one line of plain-text rationale."
      );
      break;
    case "cta":
      parts.push("Purpose: a single strong call-to-action line that fits the content and feels native to the platform (no hashtags, no URLs).");
      break;
    case "ideas":
      parts.push("Purpose: fresh content ideas based on the provided context. Each idea is one line with a working title and a one-sentence angle.");
      break;
    case "rewrite":
      parts.push("Purpose: rewrite the provided text. Keep the meaning and facts intact — improve clarity, flow, and platform fit.");
      break;
    case "tone":
      parts.push("Purpose: rephrase the provided text into the requested tone without changing the meaning or the facts.");
      break;
  }

  if (source) {
    parts.push(`\nSource content:\n"""\n${source}\n"""`);
  }

  return parts.join("\n\n");
}
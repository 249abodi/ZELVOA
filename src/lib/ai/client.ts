export type ComposerFeature = "captions" | "hashtags" | "cta" | "ideas" | "rewrite" | "tone";

export interface AIStatusData {
  enabled: boolean;
  message: string;
  code: string | null;
  model: string | null;
  monthlyUsage: number;
  monthlyLimit: number;
  remaining: number;
}

export interface AIGenerateResult {
  generated: boolean;
  output?: {
    caption?: string;
    hashtags?: string[];
    cta?: string;
    ideas?: { title: string; description: string; format?: string }[];
    rewritten?: string;
  };
}

export interface AIGenerateOptions {
  feature: ComposerFeature;
  content?: string;
  platform?: string;
  language?: "en" | "ar";
  tone?: string;
  length?: string;
  count?: number;
}

export async function fetchAIStatus(): Promise<AIStatusData> {
  const res = await fetch("/api/v1/ai/status");
  if (!res.ok) throw new Error("status_failed");
  const data = (await res.json()) as { data: AIStatusData };
  return data.data;
}

export async function generateAI(
  opts: AIGenerateOptions
): Promise<{ data?: AIGenerateResult; error?: { message?: string; code?: string } }> {
  const res = await fetch("/api/v1/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = (await res.json()) as {
    data?: AIGenerateResult;
    error?: { message?: string; code?: string };
  };
  if (!res.ok) return { error: data.error ?? { message: "Generation failed." } };
  if (data.data?.generated === false) {
    return { error: { message: "Generation not yet available." } };
  }
  return { data: data.data };
}
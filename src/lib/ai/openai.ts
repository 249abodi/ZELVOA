import {
  AIProviderError,
  type AICompletion,
  type AIProvider,
} from "@/lib/ai/types";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

function configured(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0 || apiKey.startsWith("sk-dummy")) return null;
  return {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: process.env.AI_MODEL || DEFAULT_MODEL,
  };
}

export class OpenAIChatProvider implements AIProvider {
  readonly name = "openai";
  readonly model: string;

  constructor(model?: string) {
    this.model = model ?? configured()?.model ?? DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return configured() !== null;
  }

  async complete(system: string, user: string): Promise<AICompletion> {
    const cfg = configured();
    if (!cfg) {
      throw new AIProviderError("The AI provider is not configured.", 501);
    }

    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.8,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      let detail = `AI provider returned ${res.status}.`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) detail = body.error.message;
      } catch {
        // ignore parse errors — keep the status detail
      }
      throw new AIProviderError(detail, res.status);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new AIProviderError("The AI provider returned an empty response.", 502);
    }

    return {
      text,
      model: data.model ?? cfg.model,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    };
  }
}

export { configured as resolveAIProviderConfig };
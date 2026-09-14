import {
  AIProviderError,
  type AICompletion,
  type AIErrorCode,
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

export function mapProviderError(status: number | undefined): {
  code: AIErrorCode;
  status: number;
  message: string;
} {
  if (status === 401 || status === 403) {
    return { code: "AI_UNAUTHORIZED", status: 502, message: "The AI provider rejected the configured API key." };
  }
  if (status === 429) {
    return { code: "AI_RATE_LIMITED", status: 429, message: "The AI provider is rate-limiting requests. Please try again shortly." };
  }
  if (status === 408) {
    return { code: "AI_TIMEOUT", status: 504, message: "The AI provider took too long to respond." };
  }
  if (status === 400 || status === 404) {
    return { code: "AI_INVALID_REQUEST", status: 400, message: "The AI provider rejected the request as invalid." };
  }
  if (status === 500 || status === 502 || status === 503) {
    return { code: "AI_PROVIDER_UNAVAILABLE", status: 502, message: "The AI provider is temporarily unavailable." };
  }
  return { code: "AI_UNKNOWN_ERROR", status: 502, message: "The AI provider returned an unexpected error." };
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
    return this.request(system, user, false);
  }

  async completeJSON(system: string, user: string): Promise<AICompletion> {
    return this.request(system, user, true);
  }

  private async request(
    system: string,
    user: string,
    jsonMode: boolean
  ): Promise<AICompletion> {
    const cfg = configured();
    if (!cfg) {
      throw new AIProviderError("The AI provider is not configured.", 501);
    }

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: jsonMode ? 0.7 : 0.8,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };

    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new AIProviderError("The AI provider took too long to respond.", 408);
      }
      throw new AIProviderError("Could not reach the AI provider.", 502);
    }

    if (!res.ok) {
      let detail = `AI provider returned ${res.status}.`;
      try {
        const parsed = (await res.json()) as { error?: { message?: string } };
        if (parsed.error?.message) detail = parsed.error.message;
      } catch {
        // keep default detail
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

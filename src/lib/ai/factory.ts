import { OpenAIChatProvider } from "@/lib/ai/openai";
import type { AIProvider } from "@/lib/ai/types";

let provider: AIProvider | null = null;

export function getAIProvider(): AIProvider | null {
  if (!process.env.AI_API_KEY) return null;
  if (!provider) provider = new OpenAIChatProvider();
  return provider;
}

export function isAIEnabled(): boolean {
  const p = getAIProvider();
  return p !== null && p.isConfigured();
}

export function aiConfigurationReason(): string | null {
  if (isAIEnabled()) return null;
  return aiConfigHint();
}

export function aiConfigHint(): string {
  if (!process.env.AI_API_KEY) {
    return "Add AI_API_KEY (and optionally AI_BASE_URL / AI_MODEL) to enable the AI assistant. No AI provider is faked — without credentials this studio stays disabled.";
  }
  if (process.env.AI_API_KEY?.startsWith("sk-dummy")) {
    return "The configured AI_API_KEY is a placeholder. Set a real key to enable the AI assistant.";
  }
  return "AI is enabled.";
}
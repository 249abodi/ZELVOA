export interface AICompletion {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  complete(system: string, user: string): Promise<AICompletion>;
  completeJSON(system: string, user: string): Promise<AICompletion>;
}

export type AIFeature =
  | "captions"
  | "hashtags"
  | "cta"
  | "ideas"
  | "rewrite"
  | "tone";

export type AITone = "professional" | "friendly" | "luxury" | "playful" | "bold" | "neutral";

export type AILength = "short" | "medium" | "long";

export type AILanguage = "en" | "ar";

export type AIErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_UNAUTHORIZED"
  | "AI_RATE_LIMITED"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_INVALID_REQUEST"
  | "AI_TIMEOUT"
  | "AI_UNKNOWN_ERROR";

export class AIProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "AIProviderError";
  }
}

export class AIOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIOutputError";
  }
}

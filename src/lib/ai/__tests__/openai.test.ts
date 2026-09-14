import { afterEach, describe, expect, test, vi } from "vitest";
import { OpenAIChatProvider } from "@/lib/ai/openai";
import { AIProviderError } from "@/lib/ai/types";
import { getAIProvider, isAIEnabled } from "@/lib/ai/factory";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OpenAIChatProvider", () => {
  test("isConfigured false when no API key", () => {
    vi.stubEnv("AI_API_KEY", "");
    expect(new OpenAIChatProvider("gpt-test").isConfigured()).toBe(false);
  });

  test("isConfigured false for dummy placeholder key", () => {
    vi.stubEnv("AI_API_KEY", "sk-dummy-placeholder");
    expect(new OpenAIChatProvider("gpt-test").isConfigured()).toBe(false);
  });

  test("isConfigured true with a real-looking key", () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    expect(new OpenAIChatProvider("gpt-test").isConfigured()).toBe(true);
  });

  test("complete returns text and token usage", async () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    vi.stubEnv("AI_BASE_URL", "https://example-ai.test/v1/");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: "gpt-test",
        choices: [{ message: { content: "Hello from AI" } }],
        usage: { prompt_tokens: 12, completion_tokens: 4 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIChatProvider("gpt-test");
    const result = await provider.complete("system", "user");

    expect(result.text).toBe("Hello from AI");
    expect(result.model).toBe("gpt-test");
    expect(result.promptTokens).toBe(12);
    expect(result.completionTokens).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example-ai.test/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("completeJSON requests JSON object response format", async () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: "gpt-test",
          choices: [{ message: { content: '{"caption":"hi"}' } }],
          usage: { prompt_tokens: 3, completion_tokens: 3 },
        }),
      })
    );
    const fetchMock = vi.mocked(fetch);

    const provider = new OpenAIChatProvider("gpt-test");
    const result = await provider.completeJSON("system", "user");

    expect(result.text).toBe('{"caption":"hi"}');
    const body = JSON.parse((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("plain complete does not request JSON format", async () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
      })
    );
    const fetchMock = vi.mocked(fetch);
    const provider = new OpenAIChatProvider("gpt-test");
    await provider.complete("system", "user");
    const body = JSON.parse((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.response_format).toBeUndefined();
  });

  test("complete honors custom model override", async () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ model: "custom-model", choices: [{ message: { content: "x" } }] }),
      })
    );
    const fetchMock = vi.mocked(fetch);
    const provider = new OpenAIChatProvider("custom-model");
    await provider.complete("system", "user");
    const body = JSON.parse((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.model).toBe("custom-model");
  });

  test("complete throws AIProviderError on non-200", async () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "rate limited" } }),
      })
    );
    const provider = new OpenAIChatProvider("gpt-test");
    await expect(provider.complete("s", "u")).rejects.toBeInstanceOf(AIProviderError);
  });

  test("throws provider error with mapped status when network fails", async () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const provider = new OpenAIChatProvider("gpt-test");
    const err = await provider.complete("s", "u").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect((err as AIProviderError).status).toBe(502);
  });

  test("throws timeout provider error on TimeoutError", async () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"))
    );
    const provider = new OpenAIChatProvider("gpt-test");
    const err = await provider.complete("s", "u").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect((err as AIProviderError).status).toBe(408);
  });

  test("complete throws when response is empty", async () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "  " } }] }),
      })
    );
    const provider = new OpenAIChatProvider("gpt-test");
    await expect(provider.complete("s", "u")).rejects.toThrow(/empty response/);
  });
});

describe("ai factory", () => {
  test("isAIEnabled false when unconfigured", () => {
    vi.stubEnv("AI_API_KEY", "");
    expect(isAIEnabled()).toBe(false);
    expect(getAIProvider()).toBeNull();
  });

  test("isAIEnabled true when configured", () => {
    vi.stubEnv("AI_API_KEY", "sk-1234real");
    expect(isAIEnabled()).toBe(true);
    expect(getAIProvider()).toBeInstanceOf(OpenAIChatProvider);
  });

  test("isAIEnabled false when only dummy key configured", () => {
    vi.stubEnv("AI_API_KEY", "sk-dummy-placeholder");
    expect(isAIEnabled()).toBe(false);
  });
});
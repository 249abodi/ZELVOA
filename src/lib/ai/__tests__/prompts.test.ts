import { describe, expect, test } from "vitest";
import { buildPrompt } from "@/lib/ai/prompts";

describe("buildPrompt", () => {
  test("includes platform label", () => {
    const prompt = buildPrompt({ feature: "captions", platform: "INSTAGRAM" });
    expect(prompt).toContain("Instagram");
  });

  test("includes generic platform when missing", () => {
    const prompt = buildPrompt({ feature: "cta" });
    expect(prompt).toContain("social media");
  });

  test("includes tone and length hints", () => {
    const prompt = buildPrompt({ feature: "rewrite", tone: "luxury", length: "short" });
    expect(prompt.toLowerCase()).toContain("luxury");
    expect(prompt).toContain("1–2 sentences");
  });

  test("includes count hint for multiple options", () => {
    const prompt = buildPrompt({ feature: "ideas", count: 3 });
    expect(prompt).toContain("3 distinct options");
  });

  test("embeds source content", () => {
    const prompt = buildPrompt({ feature: "captions", content: "Hello world" });
    expect(prompt).toContain("Hello world");
  });

  test("rewrite feature requires source and preserves meaning intent", () => {
    const prompt = buildPrompt({ feature: "rewrite", content: "Buy our product now" });
    expect(prompt).toContain("rewrite");
    expect(prompt.toLowerCase()).toContain("meaning");
  });
});
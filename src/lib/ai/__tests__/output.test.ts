import { describe, expect, test } from "vitest";
import { extractStructuredJSON } from "@/lib/ai/output";
import { AIOutputError } from "@/lib/ai/types";

describe("extractStructuredJSON", () => {
  test("parses a caption output", () => {
    const out = extractStructuredJSON('{"caption": "Hello world"}', "captions");
    expect(out).toEqual({ caption: "Hello world" });
  });

  test("parses a hashtags output", () => {
    const out = extractStructuredJSON('{"hashtags": ["#one", "#two"]}', "hashtags");
    expect(out).toEqual({ hashtags: ["#one", "#two"] });
  });

  test("parses a cta output", () => {
    const out = extractStructuredJSON('{"cta": "Link in bio"}', "cta");
    expect(out).toEqual({ cta: "Link in bio" });
  });

  test("parses an ideas output", () => {
    const out = extractStructuredJSON(
      '{"ideas": [{"title": "Behind the scenes", "description": "Share a day in the office.", "format": "Reel"}]}',
      "ideas"
    );
    expect(out).toEqual({
      ideas: [{ title: "Behind the scenes", description: "Share a day in the office.", format: "Reel" }],
    });
  });

  test("parses a rewrite output", () => {
    const out = extractStructuredJSON('{"rewritten": "Cleaner text."}', "rewrite");
    expect(out).toEqual({ rewritten: "Cleaner text." });
  });

  test("rejects invalid JSON with a controlled error", () => {
    expect(() => extractStructuredJSON("not json at all", "captions")).toThrow(AIOutputError);
    expect(() => extractStructuredJSON("not json at all", "captions")).toThrow(/invalid JSON/);
  });

  test("rejects JSON missing required fields", () => {
    expect(() => extractStructuredJSON('{"other": 1}', "captions")).toThrow(AIOutputError);
    expect(() => extractStructuredJSON('{"caption": ""}', "rewrite")).toThrow(AIOutputError);
  });

  test("rejects empty hashtags array", () => {
    expect(() => extractStructuredJSON('{"hashtags": []}', "hashtags")).toThrow(AIOutputError);
  });

  test("rejects empty ideas array", () => {
    expect(() => extractStructuredJSON('{"ideas": []}', "ideas")).toThrow(AIOutputError);
  });
});
import { describe, expect, test } from "vitest";
import { mapProviderError } from "@/lib/ai/openai";

describe("mapProviderError", () => {
  test("maps 401 and 403 to unauthorized (502)", () => {
    const e = mapProviderError(401);
    expect(e).toEqual({ code: "AI_UNAUTHORIZED", status: 502, message: expect.any(String) });
  });

  test("maps 429 to rate limited (429)", () => {
    const e = mapProviderError(429);
    expect(e.code).toBe("AI_RATE_LIMITED");
    expect(e.status).toBe(429);
  });

  test("maps 408 to timeout (504)", () => {
    const e = mapProviderError(408);
    expect(e.code).toBe("AI_TIMEOUT");
    expect(e.status).toBe(504);
  });

  test("maps 400 and 404 to invalid request", () => {
    expect(mapProviderError(400).code).toBe("AI_INVALID_REQUEST");
    expect(mapProviderError(404).code).toBe("AI_INVALID_REQUEST");
  });

  test("maps 5xx to provider unavailable", () => {
    for (const s of [500, 502, 503]) {
      expect(mapProviderError(s).code).toBe("AI_PROVIDER_UNAVAILABLE");
    }
  });

  test("maps unknown statuses to unknown error", () => {
    const e = mapProviderError(418);
    expect(e.code).toBe("AI_UNKNOWN_ERROR");
    expect(e.status).toBe(502);
  });
});
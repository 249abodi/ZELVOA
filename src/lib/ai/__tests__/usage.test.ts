import { afterEach, describe, expect, test, vi } from "vitest";
import {
  assertUserAIAvailable,
  monthlyRequestLimit,
} from "@/lib/ai/usage";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("monthlyRequestLimit", () => {
  test("defaults to 2000 requests", () => {
    expect(monthlyRequestLimit()).toBe(2000);
  });

  test("parses numeric env override", () => {
    vi.stubEnv("AI_MONTHLY_REQUEST_LIMIT", "500");
    expect(monthlyRequestLimit()).toBe(500);
  });

  test("ignores invalid override", () => {
    vi.stubEnv("AI_MONTHLY_REQUEST_LIMIT", "lots");
    expect(monthlyRequestLimit()).toBe(2000);
  });
});

describe("assertUserAIAvailable", () => {
  test("allows first calls", () => {
    expect(() => assertUserAIAvailable("user-a")).not.toThrow();
  });

  test("blocked once the sliding window fills", () => {
    for (let i = 0; i < 60; i++) {
      assertUserAIAvailable("user-b");
    }
    expect(() => assertUserAIAvailable("user-b")).toThrow(/rate limit/);
  });

  test("different users are independent", () => {
    for (let i = 0; i < 60; i++) {
      assertUserAIAvailable("user-c");
    }
    expect(() => assertUserAIAvailable("user-c")).toThrow(/rate limit/);
    expect(() => assertUserAIAvailable("user-d")).not.toThrow();
  });
});
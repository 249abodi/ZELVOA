import { describe, expect, it } from "vitest";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";

describe("checkAuthRateLimit", () => {
  const makeRequest = (ip: string) =>
    new Request("http://localhost/api/v1/auth/login", {
      headers: { "x-forwarded-for": ip },
    });

  it("allows a burst of 10 attempts", () => {
    for (let i = 0; i < 10; i++) {
      const result = checkAuthRateLimit(makeRequest(`192.168.0.${i}`));
      expect(result.allowed).toBe(true);
      expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });

  it("blocks the 11th attempt and returns a retry-after", () => {
    const ip = "10.9.8.7";
    let result;
    for (let i = 0; i < 10; i++) {
      result = checkAuthRateLimit(makeRequest(ip));
    }
    result = checkAuthRateLimit(makeRequest(ip));
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("does not share limits between distinct IPs", () => {
    const result = checkAuthRateLimit(makeRequest("203.0.113.5"));
    expect(result.allowed).toBe(true);
  });

  it("falls back to a shared key when no IP is present", () => {
    const request = new Request("http://localhost/api/v1/auth/login");
    const result = checkAuthRateLimit(request);
    expect(result.allowed).toBe(true);
  });
});
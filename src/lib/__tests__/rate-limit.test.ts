import { describe, it, expect, vi, afterEach } from "vitest";
import { InMemoryRateLimiter, generateState } from "@/lib/rate-limit";

describe("InMemoryRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const limiter = new InMemoryRateLimiter(3, 1000);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    const third = limiter.check("k");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks requests at the limit", () => {
    const limiter = new InMemoryRateLimiter(2, 1000);
    limiter.check("k");
    limiter.check("k");
    expect(limiter.check("k").allowed).toBe(false);
    expect(limiter.check("k").remaining).toBe(0);
  });

  it("tracks keys independently", () => {
    const limiter = new InMemoryRateLimiter(1, 1000);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const limiter = new InMemoryRateLimiter(1, 1000);
    limiter.check("k");
    expect(limiter.check("k").allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(limiter.check("k").allowed).toBe(true);
  });
});

describe("generateState", () => {
  it("produces URL-safe unique states", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
    expect(/^[A-Za-z0-9_-]+$/.test(a)).toBe(true);
  });
});
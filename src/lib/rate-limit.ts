import { randomBytes } from "crypto";

export class InMemoryRateLimiter {
  private store = new Map<string, number[]>();

  constructor(
    private limit: number,
    private windowMs: number
  ) {}

  check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const hits = (this.store.get(key) ?? []).filter((t) => t > windowStart);
    if (hits.length >= this.limit) {
      this.store.set(key, hits);
      return { allowed: false, remaining: 0, resetMs: this.windowMs - (now - hits[0]) };
    }
    hits.push(now);
    this.store.set(key, hits);
    return { allowed: true, remaining: this.limit - hits.length, resetMs: 0 };
  }
}

export function generateState(): string {
  return randomBytes(24).toString("base64url");
}
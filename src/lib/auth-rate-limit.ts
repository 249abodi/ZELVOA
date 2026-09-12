import { InMemoryRateLimiter } from "@/lib/rate-limit";

const limiter = new InMemoryRateLimiter(10, 60_000);

export function checkAuthRateLimit(request: Request): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  const result = limiter.check(`auth:${ip}`);
  return {
    allowed: result.allowed,
    retryAfterSeconds: Math.max(1, Math.ceil(result.resetMs / 1000)),
  };
}
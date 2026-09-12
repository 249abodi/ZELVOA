import { describe, expect, test } from "vitest";
import { analyticsQuerySchema, analyticsSyncSchema } from "@/lib/validators";

describe("analyticsQuerySchema", () => {
  test("accepts valid from/to dates", () => {
    const parsed = analyticsQuerySchema.parse({
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(parsed.from).toBe("2026-01-01");
    expect(parsed.to).toBe("2026-01-31");
    expect(parsed.platform).toBeUndefined();
  });

  test("accepts an optional platform and coerced days", () => {
    const parsed = analyticsQuerySchema.parse({
      from: "2026-01-01",
      to: "2026-01-31",
      platform: "INSTAGRAM",
      days: "90",
    });
    expect(parsed.platform).toBe("INSTAGRAM");
    expect(parsed.days).toBe(90);
  });

  test("rejects malformed dates", () => {
    expect(() =>
      analyticsQuerySchema.parse({ from: "01/01/2026", to: "2026-01-31" })
    ).toThrow();
  });

  test("rejects an unknown platform", () => {
    expect(() =>
      analyticsQuerySchema.parse({ from: "2026-01-01", to: "2026-01-31", platform: "SNAPCHAT" })
    ).toThrow();
  });
});

describe("analyticsSyncSchema", () => {
  test("accepts empty body", () => {
    expect(analyticsSyncSchema.parse({}).from).toBeUndefined();
  });

  test("accepts valid dates", () => {
    const parsed = analyticsSyncSchema.parse({
      from: "2026-01-01",
      to: "2026-01-10",
    });
    expect(parsed.to).toBe("2026-01-10");
  });

  test("rejects malformed dates", () => {
    expect(() => analyticsSyncSchema.parse({ from: "yesterday" })).toThrow();
  });
});
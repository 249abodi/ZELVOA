import { describe, expect, it } from "vitest";
import { formatCurrency, formatPlanPrice } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats USD amounts", () => {
    expect(formatCurrency(29, "USD")).toBe("$29.00");
    expect(formatCurrency(79, "USD")).toBe("$79.00");
    expect(formatCurrency(199, "USD")).toBe("$199.00");
  });

  it("returns 'Free' for zero", () => {
    expect(formatCurrency(0, "USD")).toBe("Free");
  });

  it("formats arbitrary currencies via Intl", () => {
    expect(formatCurrency(290, "USD")).toBe("$290.00");
  });

  it("does not silently convert price numbers", () => {
    const out = formatCurrency(29, "MYR");
    expect(out).toContain("29");
    expect(out).not.toBe("$29.00");
  });
});

describe("formatPlanPrice", () => {
  it("appends /month for paid plans", () => {
    expect(formatPlanPrice(29, "USD")).toBe("$29.00/month");
    expect(formatPlanPrice(79, "USD")).toBe("$79.00/month");
  });

  it("keeps Free bare", () => {
    expect(formatPlanPrice(0, "USD")).toBe("Free");
    expect(formatPlanPrice(0, "USD", "year")).toBe("Free");
  });
});
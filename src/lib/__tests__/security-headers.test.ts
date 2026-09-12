import { describe, expect, it } from "vitest";
import { buildSecurityHeaders, buildCspHeader } from "@/lib/security-headers";

describe("buildSecurityHeaders", () => {
  it("sends nosniff and frame denial", () => {
    const headers = buildSecurityHeaders();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("sets referrer and permissions policies", () => {
    const headers = buildSecurityHeaders();
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("includes HSTS in production", () => {
    const headers = buildSecurityHeaders({ production: true });
    expect(headers["Strict-Transport-Security"]).toContain("max-age=63072000");
  });

  it("omits HSTS outside production", () => {
    const headers = buildSecurityHeaders({ production: false });
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("buildCspHeader", () => {
  it("locks frame-ancestors and base-uri to self", () => {
    const csp = buildCspHeader("abc123");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("injects the provided nonce into script-src", () => {
    const csp = buildCspHeader("nonce-value");
    expect(csp).toContain("script-src 'self' 'nonce-nonce-value'");
  });

  it("uses a nonce without unsafe-inline in script-src", () => {
    const csp = buildCspHeader("abc");
    expect(csp).toContain("script-src 'self' 'nonce-abc'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});
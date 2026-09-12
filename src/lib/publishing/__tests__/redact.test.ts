import { describe, it, expect } from "vitest";
import { redactText, redactUrl, redactError } from "@/lib/integrations/redact";

describe("redactText", () => {
  it("redacts access_token query-style values", () => {
    const out = redactText("access_token=EAASHDRXGQUZZsuperlongvalue");
    expect(out).toContain("access_token=***");
    expect(out).not.toContain("EAASHDRXGQUZZ");
  });

  it("redacts refresh_token and client_secret values", () => {
    const out = redactText("refresh_token=rt1234567890abcdef client_secret=cs1234567890");
    expect(out).toContain("***");
    expect(out).not.toContain("rt1234567890");
    expect(out).not.toContain("cs1234567890");
  });

  it("redacts bearer tokens", () => {
    const out = redactText("Authorization: Bearer abcdef1234567890XYZ");
    expect(out).toContain("Bearer ***");
    expect(out).not.toContain("abcdef1234567890XYZ");
  });

  it("redacts dev tokens", () => {
    const out = redactText("dev-access-abcd1234efgh5678");
    expect(out).not.toContain("dev-access-abcd1234efgh5678");
  });

  it("redacts long base64/hex blobs", () => {
    const out = redactText("value eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.abcdefghijklmnopqrstuvwxyz");
    expect(out).not.toContain("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9");
  });

  it("leaves normal text untouched", () => {
    const out = redactText("Publishing failed for account. Message: rate limit reached.");
    expect(out).toContain("rate limit reached");
    expect(out).not.toContain("***");
  });
});

describe("redactUrl", () => {
  it("redacts token/signature query params but keeps the rest", () => {
    const url =
      "https://app.example.com/api/v1/media/m1/file?code=abc123&refresh_token=zzz999&file=p.jpg";
    const out = redactUrl(url);
    expect(out).toContain("code=");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("zzz999");
    expect(out).toContain("file=p.jpg");
  });

  it("redacts provider error strings that embed tokens", () => {
    const out = redactError(new Error("graph call failed: access_token=EAABcrisTopinTvMkLive"));
    expect(out).not.toContain("EAABcrisTopinTvMkLive");
    expect(out).toContain("graph call failed");
  });
});
import { describe, it, expect, afterEach } from "vitest";
import { encryptSecret, decryptSecret, generateOAuthState } from "@/lib/crypto";

const originalKey = process.env.ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalKey;
});

describe("token encryption", () => {
  it("round-trips a secret", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    const payload = encryptSecret("super-secret-token");
    expect(payload).not.toContain("super-secret-token");
    expect(decryptSecret(payload)).toBe("super-secret-token");
  });

  it("produces unique ciphertext for identical inputs (random IV)", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong key", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    const payload = encryptSecret("token");
    process.env.ENCRYPTION_KEY = "b".repeat(64);
    expect(() => decryptSecret(payload)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    const payload = encryptSecret("token");
    const parts = payload.split(".");
    parts[2] = parts[2].slice(0, -2) + "00";
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("throws a clear error when ENCRYPTION_KEY is missing", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/ENCRYPTION_KEY/);
  });

  it("rejects a non-32-byte encryption key", () => {
    process.env.ENCRYPTION_KEY = "tooshort";
    expect(() => encryptSecret("x")).toThrow(/32-byte/);
  });

  it("generates URL-safe OAuth state", () => {
    const state = generateOAuthState();
    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(/^[A-Za-z0-9_-]+$/.test(state)).toBe(true);
  });
});
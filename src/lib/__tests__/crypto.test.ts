import { describe, it, expect, afterEach } from "vitest";
import { createHash } from "crypto";
import { encryptSecret, decryptSecret, generateOAuthState, hashPassword, verifyPassword } from "@/lib/crypto";

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

describe("password hashing", () => {
  it("hashes with bcrypt and verifies correctly", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(hash.startsWith("$2")).toBe(true);
    expect(hash).not.toContain("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces unique hashes for the same password (random salt)", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("still verifies legacy pre-bcrypt hashes", () => {
    const legacy = encodeURIComponent(`${"a".repeat(32)}$${createHash("sha256").update("a".repeat(32) + "legacy-password").digest("hex")}`);
    expect(verifyPassword("legacy-password", legacy)).toBe(true);
    expect(verifyPassword("wrong", legacy)).toBe(false);
  });

  it("returns false for malformed stored hashes", () => {
    expect(verifyPassword("x", "not-a-valid-hash")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });
});
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const TEST_SECRET = "test-only-secret-do-not-use-0123456789abcdef";
const OTHER_SECRET = "test-only-different-secret-value-xxxxxxxxxxxx";

function setProductionEnvironment(authSecret: string) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_SECRET", authSecret);
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("AUTH_SECRET production requirements", () => {
  test("signSession throws AUTH_SECRET is not configured when missing in production", async () => {
    setProductionEnvironment("");
    vi.resetModules();
    const session = await import("@/lib/session");
    await expect(session.signSession({ sub: "user-1" })).rejects.toThrow(
      "AUTH_SECRET is not configured."
    );
  });

  test("verifySession fails closed (returns null) when AUTH_SECRET is missing", async () => {
    setProductionEnvironment("");
    vi.resetModules();
    const session = await import("@/lib/session");
    const decoded = await session.verifySession("fake.signed.token");
    expect(decoded).toBeNull();
  });

  test("signs and verifies a session when AUTH_SECRET is present", async () => {
    setProductionEnvironment(TEST_SECRET);
    vi.resetModules();
    const session = await import("@/lib/session");
    const token = await session.signSession({
      sub: "user-1",
      org: "org-1",
      ws: "ws-1",
      role: "OWNER",
    });
    expect(token).toBeTruthy();
    const decoded = await session.verifySession(token);
    expect(decoded).toEqual({ sub: "user-1", org: "org-1", ws: "ws-1", role: "OWNER" });
  });

  test("tokens signed with one secret are rejected when the secret changes", async () => {
    setProductionEnvironment(TEST_SECRET);
    vi.resetModules();
    const session = await import("@/lib/session");
    const token = await session.signSession({ sub: "user-1" });

    vi.stubEnv("AUTH_SECRET", OTHER_SECRET);
    const decoded = await session.verifySession(token);
    expect(decoded).toBeNull();
  });

  test("rejects tampered tokens", async () => {
    setProductionEnvironment(TEST_SECRET);
    vi.resetModules();
    const session = await import("@/lib/session");
    const token = await session.signSession({ sub: "user-1" });
    const decoded = await session.verifySession(token + "tampered");
    expect(decoded).toBeNull();
  });
});

describe("AUTH_SECRET error safety", () => {
  test("signSession error message never contains the secret value", async () => {
    setProductionEnvironment("");
    vi.resetModules();
    const session = await import("@/lib/session");
    await expect(session.signSession({ sub: "user-1" })).rejects.toThrow(
      expect.not.stringContaining(OTHER_SECRET)
    );
    try {
      await session.signSession({ sub: "user-1" });
    } catch (error) {
      expect(String(error)).not.toContain(TEST_SECRET);
      expect(String(error)).not.toContain(OTHER_SECRET);
      expect(String(error)).toBe("Error: AUTH_SECRET is not configured.");
    }
  });
});

describe("crypto signature (media URLs) uses the same auth secret", () => {
  test("createSignature requires AUTH_SECRET in production", async () => {
    setProductionEnvironment("");
    vi.resetModules();
    const cryptoMod = await import("@/lib/crypto");
    expect(() => cryptoMod.createSignature("media:123")).toThrow(
      "AUTH_SECRET is not configured."
    );
  });

  test("createSignature works and verifies when AUTH_SECRET is present", async () => {
    setProductionEnvironment(TEST_SECRET);
    vi.resetModules();
    const cryptoMod = await import("@/lib/crypto");
    const signature = cryptoMod.createSignature("media:123");
    expect(signature).toBeTruthy();
    expect(cryptoMod.safeEqual(cryptoMod.createSignature("media:123"), signature)).toBe(true);
  });
});
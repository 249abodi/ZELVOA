import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { XProvider } from "@/lib/integrations/providers/x";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.stubEnv("X_CLIENT_ID", "x-client-id");
  vi.stubEnv("X_CLIENT_SECRET", "x-client-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("X OAuth 2.0 PKCE", () => {
  it("builds an authorization URL with the S256 challenge and publishing scopes", () => {
    const verifier = "A".repeat(43);
    const url = new URL(new XProvider().buildAuthorizationUrl({
      state: "one-time-state",
      redirectUri: "https://app.example/api/callback",
      codeVerifier: verifier,
    }));
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("state")).toBe("one-time-state");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(url.searchParams.get("scope")).toContain("offline.access");
    expect(url.searchParams.get("scope")).toContain("tweet.write");
  });

  it("requires a verifier before authorization or code exchange", async () => {
    const provider = new XProvider();
    expect(() => provider.buildAuthorizationUrl({ state: "s", redirectUri: "https://app/cb" })).toThrow(/PKCE/);
    await expect(provider.exchangeCode("code", "https://app/cb")).rejects.toThrow(/PKCE/);
  });

  it("exchanges and refreshes tokens with confidential-client auth and the matching verifier", async () => {
    const calls: Array<{ url: string; body: URLSearchParams; authorization: string | null }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: new URLSearchParams(String(init?.body)), authorization: new Headers(init?.headers).get("Authorization") });
      return json({ access_token: "access", refresh_token: "refresh", expires_in: 7200, scope: "users.read tweet.write" });
    }));
    const provider = new XProvider();
    const exchanged = await provider.exchangeCode("one-time-code", "https://app/cb", "pkce-verifier");
    expect(calls[0].url).toBe("https://api.x.com/2/oauth2/token");
    expect(calls[0].body.get("code_verifier")).toBe("pkce-verifier");
    expect(calls[0].body.get("code")).toBe("one-time-code");
    expect(calls[0].body.has("client_id")).toBe(false);
    expect(calls[0].authorization).toMatch(/^Basic /);
    expect(exchanged).toMatchObject({ accessToken: "access", refreshToken: "refresh", expiresInSeconds: 7200 });

    await provider.refresh("refresh");
    expect(calls[1].body.get("grant_type")).toBe("refresh_token");
    expect(calls[1].body.has("client_id")).toBe(false);
    expect(calls[1].authorization).toMatch(/^Basic /);
  });

  it("retrieves the authenticated X user without requesting unavailable email data", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return json({ data: { id: "123", name: "Ada", username: "ada", profile_image_url: "https://img.example/ada" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const records = await new XProvider().getAccounts!({
      accessToken: "access",
      platformAccountId: "unused",
      name: "unused",
      scopes: ["users.read"],
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.x.com/2/users/me");
    expect(records[0]).toMatchObject({ platform: "X", platformAccountId: "123", name: "Ada", username: "ada" });
  });

  it("reports X unavailable when its environment configuration is incomplete", () => {
    vi.stubEnv("X_CLIENT_SECRET", "");
    expect(new XProvider().configured).toBe(false);
  });

  it("revokes both access and rotating refresh tokens on disconnect", async () => {
    const calls: Array<{ url: string; body: URLSearchParams }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: new URLSearchParams(String(init?.body)) });
      return json({ revoked: true });
    }));
    await new XProvider().revoke("access-token", "refresh-token");
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.url)).toEqual(["https://api.x.com/2/oauth2/revoke", "https://api.x.com/2/oauth2/revoke"]);
    expect(calls.map((call) => call.body.get("token"))).toEqual(["access-token", "refresh-token"]);
    expect(calls.map((call) => call.body.get("token_type_hint"))).toEqual(["access_token", "refresh_token"]);
  });
});

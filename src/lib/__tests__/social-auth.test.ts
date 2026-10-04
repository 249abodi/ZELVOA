import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildAuthorizationUrl,
  exchangeCode,
  fetchProfile,
  generateCodeChallenge,
  getProviderCredentials,
  isLoginProvider,
  isProviderConfigured,
  sanitizeNext,
  syntheticEmail,
} from "@/lib/social-auth";

const EMPTY_ENV = {
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  FACEBOOK_AUTH_CLIENT_ID: "",
  FACEBOOK_AUTH_CLIENT_SECRET: "",
  INSTAGRAM_AUTH_CLIENT_ID: "",
  INSTAGRAM_AUTH_CLIENT_SECRET: "",
  TIKTOK_CLIENT_KEY: "",
  TIKTOK_CLIENT_SECRET: "",
  X_CLIENT_ID: "",
  X_CLIENT_SECRET: "",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("provider config", () => {
  test("isLoginProvider only accepts supported providers", () => {
    expect(isLoginProvider("GOOGLE")).toBe(true);
    expect(isLoginProvider("X")).toBe(true);
    expect(isLoginProvider("LINKEDIN")).toBe(false);
    expect(isLoginProvider("google")).toBe(false);
  });

  test("reports configuration from login-specific env vars", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "gid");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsec");
    expect(isProviderConfigured("GOOGLE")).toBe(true);
    expect(getProviderCredentials("GOOGLE")).toEqual({
      clientId: "gid",
      clientSecret: "gsec",
    });
    expect(isProviderConfigured("FACEBOOK")).toBe(false);
  });
});

describe("buildAuthorizationUrl", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(EMPTY_ENV)) vi.stubEnv(k, v);
  });

  test("builds a Google authorize URL with login scopes", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "gid-123");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsec-123");
    const url = buildAuthorizationUrl({
      provider: "GOOGLE",
      state: "s1",
      redirectUri: "https://x.app/api/v1/auth/oauth/google/callback",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(parsed.searchParams.get("client_id")).toBe("gid-123");
    expect(parsed.searchParams.get("state")).toBe("s1");
    expect(parsed.searchParams.get("scope")).toContain("openid");
    expect(parsed.searchParams.get("scope")).toContain("email");
    expect(parsed.searchParams.get("code_challenge")).toBeNull();
  });

  test("uses the current X authorize endpoint and only the login scope with PKCE", () => {
    vi.stubEnv("X_CLIENT_ID", "xid");
    vi.stubEnv("X_CLIENT_SECRET", "xs");
    const verifier = "verifier-abc";
    const url = buildAuthorizationUrl({
      provider: "X",
      state: "s2",
      redirectUri: "https://x.app/api/v1/auth/oauth/x/callback",
      codeChallenge: generateCodeChallenge(verifier),
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(parsed.searchParams.get("scope")).toBe("users.read");
    expect(parsed.searchParams.get("prompt")).toBeNull();
    expect(parsed.searchParams.get("code_challenge")).toBe(
      generateCodeChallenge(verifier)
    );
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });

  test("requires a PKCE challenge for X", () => {
    vi.stubEnv("X_CLIENT_ID", "xid");
    vi.stubEnv("X_CLIENT_SECRET", "xs");
    expect(() => buildAuthorizationUrl({
      provider: "X",
      state: "s",
      redirectUri: "https://x.app/cb",
    })).toThrow(/PKCE/);
  });

  test("throws when the provider is not configured", () => {
    expect(() =>
      buildAuthorizationUrl({
        provider: "TIKTOK",
        state: "s",
        redirectUri: "https://x.app/cb",
      })
    ).toThrow("not configured");
  });
});

describe("exchangeCode", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(EMPTY_ENV)) vi.stubEnv(k, v);
    vi.stubEnv("FACEBOOK_AUTH_CLIENT_ID", "fid");
    vi.stubEnv("FACEBOOK_AUTH_CLIENT_SECRET", "fsec");
  });

  test("exchanges an authorization code for an access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok-1", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await exchangeCode({
      provider: "FACEBOOK",
      code: "code-1",
      redirectUri: "https://x.app/cb",
    });

    expect(token).toBe("tok-1");
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("client_id")).toBe("fid");
    expect(body.get("client_secret")).toBe("fsec");
    expect(body.get("code")).toBe("code-1");
    expect(body.get("redirect_uri")).toBe("https://x.app/cb");
  });

  test("throws when the provider denies the exchange", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 403 })));
    await expect(
      exchangeCode({ provider: "FACEBOOK", code: "c", redirectUri: "u" })
    ).rejects.toThrow(/Token exchange failed/);
  });

  test("exchanges X code with Basic auth, PKCE, and no duplicate credentials", async () => {
    vi.stubEnv("X_CLIENT_ID", "xid");
    vi.stubEnv("X_CLIENT_SECRET", "xsecret");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: "tok-x" }));
    vi.stubGlobal("fetch", fetchMock);

    await exchangeCode({
      provider: "X",
      code: "code-x",
      redirectUri: "https://x.app/cb",
      codeVerifier: "verifier-x",
    });

    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as URLSearchParams;
    expect(endpoint).toBe("https://api.x.com/2/oauth2/token");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("xid:xsecret").toString("base64")}`
    );
    expect(body.get("code_verifier")).toBe("verifier-x");
    expect(body.get("client_id")).toBeNull();
    expect(body.get("client_secret")).toBeNull();
  });

  test("requires a PKCE verifier for X", async () => {
    vi.stubEnv("X_CLIENT_ID", "xid");
    vi.stubEnv("X_CLIENT_SECRET", "xsecret");
    await expect(exchangeCode({
      provider: "X",
      code: "code-x",
      redirectUri: "https://x.app/cb",
    })).rejects.toThrow(/PKCE/);
  });

  test("throws when no access token is returned", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    await expect(
      exchangeCode({ provider: "FACEBOOK", code: "c", redirectUri: "u" })
    ).rejects.toThrow(/did not return an access token/);
  });
});

describe("fetchProfile", () => {
  test("Google: uses verified email and stable sub", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          sub: "g-1",
          name: "Grace",
          email: "grace@a.com",
          email_verified: true,
          picture: "https://p/g.png",
        })
      )
    );
    const p = await fetchProfile("GOOGLE", "tok");
    expect(p).toEqual({
      provider: "GOOGLE",
      providerAccountId: "g-1",
      email: "grace@a.com",
      name: "Grace",
      avatarUrl: "https://p/g.png",
      emailVerified: true,
    });
  });

  test("Google: unverified email is never used for linking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          sub: "g-2",
          email: "spoof@a.com",
          email_verified: false,
        })
      )
    );
    const p = await fetchProfile("GOOGLE", "tok");
    expect(p.emailVerified).toBe(false);
  });

  test("Facebook: profile id, name and email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ id: "f-9", name: "Fr", email: "fr@a.com", picture: { data: { url: "https://p/f.png" } } })
      )
    );
    const p = await fetchProfile("FACEBOOK", "tok");
    expect(p.providerAccountId).toBe("f-9");
    expect(p.email).toBe("fr@a.com");
    expect(p.emailVerified).toBe(true);
  });

  test("Instagram: no email is available (synthetic identity)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ id: "ig-1", username: "ig.user", account_type: "PERSONAL" })
      )
    );
    const p = await fetchProfile("INSTAGRAM", "tok");
    expect(p.email).toBeNull();
    expect(p.emailVerified).toBe(false);
    expect(p.providerAccountId).toBe("ig-1");
  });

  test("TikTok: reads open_id and ignores missing email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: { user: { open_id: "tk-1", display_name: "TK" } },
          error: { code: 0 },
        })
      )
    );
    const p = await fetchProfile("TIKTOK", "tok");
    expect(p.providerAccountId).toBe("tk-1");
    expect(p.email).toBeNull();
  });

  test("X: requests only supported profile fields and does not depend on email", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { id: "x-1", name: "Xer", username: "xer", email: "not-requested@example.com" } })
    );
    vi.stubGlobal(
      "fetch",
      fetchMock
    );
    const p = await fetchProfile("X", "tok");
    expect(fetchMock.mock.calls[0][0]).toBeInstanceOf(URL);
    const profileUrl = fetchMock.mock.calls[0][0] as URL;
    expect(profileUrl.origin + profileUrl.pathname).toBe("https://api.x.com/2/users/me");
    expect(profileUrl.searchParams.get("user.fields")).toBe("id,name,username,profile_image_url");
    expect(p.email).toBeNull();
    expect(p.emailVerified).toBe(false);
    expect(p.providerAccountId).toBe("x-1");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("helpers", () => {
  test("syntheticEmail builds unique placeholder emails", () => {
    expect(syntheticEmail("INSTAGRAM", "ig-1")).toBe("instagram.ig-1@social.local");
    expect(syntheticEmail("TIKTOK", "tk-1")).toBe("tiktok.tk-1@social.local");
  });

  test("sanitizeNext only allows safe relative paths", () => {
    expect(sanitizeNext("/app/dashboard")).toBe("/app/dashboard");
    expect(sanitizeNext(null)).toBeNull();
    expect(sanitizeNext("https://evil.com")).toBeNull();
    expect(sanitizeNext("//evil.com")).toBeNull();
    expect(sanitizeNext("/".repeat(600))).toBeNull();
  });
});

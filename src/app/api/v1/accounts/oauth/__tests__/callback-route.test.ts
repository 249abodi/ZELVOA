import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as callbackGet } from "@/app/api/v1/accounts/oauth/callback/route";
import { PublishingError } from "@/lib/publishing/errors";
import { encryptSecret } from "@/lib/crypto";

const TEST_ENCRYPTION_KEY = "a".repeat(64);

const { mockPrisma, mockGetCurrentContext, mockWriteAudit, mockCreateNotification, mockProvider } = vi.hoisted(() => ({
  mockPrisma: {
    oAuthState: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    socialAccount: { upsert: vi.fn() },
    socialAccountToken: { upsert: vi.fn() },
    pendingPageSelection: { create: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  mockGetCurrentContext: vi.fn(),
  mockWriteAudit: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockProvider: {
    exchangeCode: vi.fn(),
    getAccounts: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: () => mockGetCurrentContext() }));
vi.mock("@/lib/audit", () => ({ writeAudit: (...args: unknown[]) => mockWriteAudit(...args) }));
vi.mock("@/lib/notifications/service", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));
vi.mock("@/lib/integrations/factory", () => ({
  getProvider: () => ({
    platform: "FACEBOOK",
    isDevProvider: false,
    configured: true,
    buildAuthorizationUrl: () => "https://www.facebook.com/v25.0/dialog/oauth",
    exchangeCode: (...args: unknown[]) => mockProvider.exchangeCode(...args),
    getAccounts: (...args: unknown[]) => mockProvider.getAccounts(...args),
  }),
}));

const CONTEXT = {
  user: { id: "user-1", email: "a@b.co", name: "A User", avatarUrl: null },
  organization: { id: "org-9", name: "Org", slug: "org", timezone: "UTC" },
  workspace: { id: "ws-9", name: "Workspace", slug: "ws", timezone: "UTC" },
  role: "OWNER",
};

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "st_1",
    organizationId: "org-9",
    workspaceId: "ws-9",
    platform: "FACEBOOK",
    state: "SOME-STATE-VALUE",
    redirectUri: "https://zelvoa.vercel.app/api/v1/accounts/oauth/callback",
    connectsTo: null,
    consumedAt: null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    ipAddress: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeCallback(query: string): Request {
  return new Request(`https://zelvoa.vercel.app/api/v1/accounts/oauth/callback?${query}`);
}

function discovered(overrides: Record<string, unknown> = {}) {
  return {
    platform: "FACEBOOK",
    platformAccountId: "page_1",
    name: "ZELVOA",
    username: "zelvoa",
    avatarUrl: null,
    scopes: ["pages_manage_posts", "pages_show_list"],
    status: "CONNECTED",
    token: { accessToken: "long-page-token-value", refreshToken: undefined, expiresInSeconds: null },
    isDevProvider: false,
    ...overrides,
  };
}

function igDiscovered(overrides: Record<string, unknown> = {}) {
  return {
    platform: "INSTAGRAM",
    platformAccountId: "ig_1",
    name: "ZELVOA.IG",
    username: "zelvoa.ig",
    avatarUrl: null,
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    status: "CONNECTED",
    token: { accessToken: "ig-long-token", refreshToken: undefined, expiresInSeconds: null },
    isDevProvider: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://zelvoa.vercel.app");
  vi.stubEnv("ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
  mockGetCurrentContext.mockResolvedValue(CONTEXT);
  mockWriteAudit.mockResolvedValue(true);
  mockCreateNotification.mockResolvedValue(true);
  mockPrisma.oAuthState.findUnique.mockResolvedValue(makeRecord());
  mockPrisma.oAuthState.update.mockResolvedValue({ id: "st_1", consumedAt: new Date() });
  mockPrisma.oAuthState.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.oAuthState.delete.mockResolvedValue({ id: "st_1" });
  mockPrisma.organizationMember.findFirst.mockResolvedValue({ id: "m_1" });
  mockPrisma.pendingPageSelection.create.mockImplementation(({ data }) => ({
    id: "pp_1",
    ...data,
  }));
  mockPrisma.socialAccount.upsert.mockImplementation(({ create }) => ({
    id: "acc_1",
    ...create,
  }));
  mockPrisma.socialAccountToken.upsert.mockResolvedValue({ id: "tok_1" });
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockPrisma));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("callback — state presence (must only fail as missing when absent)", () => {
  test("absent state → missing_oauth_state", async () => {
    const res = await callbackGet(makeCallback("code=abc"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "missing_oauth_state"
    );
  });

  test("empty state → missing_oauth_state", async () => {
    const res = await callbackGet(makeCallback("code=abc&state="));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "missing_oauth_state"
    );
  });

  test("does not treat a missing platform as missing state (real Meta shape parses)", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "tok", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([discovered()]);

    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("/app/accounts/select?pending=");
    expect(location).not.toContain("missing_oauth_state");
    expect(location).not.toContain("invalid_oauth_callback");
  });
});

describe("callback — state validation outcomes", () => {
  test("unknown state → invalid_oauth_state", async () => {
    mockPrisma.oAuthState.findUnique.mockResolvedValue(null);
    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "invalid_oauth_state"
    );
  });

  test("consumed state → oauth_state_already_used (replay rejected)", async () => {
    mockPrisma.oAuthState.findUnique.mockResolvedValue(makeRecord({ consumedAt: new Date() }));
    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "oauth_state_already_used"
    );
  });

  test("expired state → oauth_state_expired and the row is removed", async () => {
    mockPrisma.oAuthState.findUnique.mockResolvedValue(
      makeRecord({ expiresAt: new Date(Date.now() - 1000) })
    );
    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "oauth_state_expired"
    );
    expect(mockPrisma.oAuthState.delete).toHaveBeenCalledWith({ where: { id: "st_1" } });
  });

  test("valid state proceeds through token exchange and redirects to facebook page selection", async () => {
    mockProvider.exchangeCode.mockResolvedValue({
      accessToken: "short-token",
      refreshToken: undefined,
      expiresInSeconds: 5184000,
      scopes: ["pages_manage_posts", "pages_show_list"],
      platformAccountId: "profile_1",
    });
    mockProvider.getAccounts.mockResolvedValue([discovered()]);

    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(res.status).toBe(307);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("/app/accounts/select?pending=");
    expect(location).not.toContain("connected=true");
    expect(mockProvider.exchangeCode).toHaveBeenCalledWith(
      "abc",
      "https://zelvoa.vercel.app/api/v1/accounts/oauth/callback",
      undefined
    );
  });
});

describe("callback — facebook pending selection flow", () => {
  test("creates a PendingPageSelection for the discovered pages", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "tok", scopes: ["pages_manage_posts", "pages_show_list"] });
    mockProvider.getAccounts.mockResolvedValue([discovered(), discovered({ platformAccountId: "page_2", name: "Second Page" })]);

    await callbackGet(makeCallback("code=abc&state=zzz"));

    expect(mockPrisma.pendingPageSelection.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.pendingPageSelection.create.mock.calls[0][0];
    expect(createArg.data).toMatchObject({
      oauthStateId: "st_1",
      workspaceId: "ws-9",
      organizationId: "org-9",
      userId: "user-1",
      platform: "FACEBOOK",
    });
  });

  test("pending expiry is 10 minutes from callback time", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "tok", scopes: ["pages_manage_posts"] });
    mockProvider.getAccounts.mockResolvedValue([discovered()]);
    const before = Date.now();

    await callbackGet(makeCallback("code=abc&state=zzz"));

    const createArg = mockPrisma.pendingPageSelection.create.mock.calls[0][0];
    const expiresAt = createArg.data.expiresAt as Date;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 10 * 60 * 1000 - 2000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(before + 10 * 60 * 1000 + 2000);
  });

  test("consumes the OAuthState in the same transaction as pending creation", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "tok", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([discovered()]);

    await callbackGet(makeCallback("code=abc&state=zzz"));

    expect(mockPrisma.oAuthState.update).toHaveBeenCalledWith({
      where: { id: "st_1" },
      data: { consumedAt: expect.any(Date), encryptedCodeVerifier: null },
    });
    expect(mockPrisma.oAuthState.update).toHaveBeenCalledTimes(1);
  });

  test("does NOT immediately create SocialAccount or SocialAccountToken", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "tok", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([discovered()]);

    await callbackGet(makeCallback("code=abc&state=zzz"));

    expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.socialAccountToken.upsert).not.toHaveBeenCalled();
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  test("encrypts stored page tokens and never exposes them on the redirect", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "short-token", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([
      discovered({ token: { accessToken: "super-secret-page-token", refreshToken: undefined, expiresInSeconds: null } }),
    ]);

    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("/app/accounts/select?pending=");
    expect(location).not.toContain("super-secret-page-token");
    expect(location).not.toContain("short-token");
    expect(location).not.toContain("state=zzz");
    expect(location).not.toContain("code=abc");

    const createArg = mockPrisma.pendingPageSelection.create.mock.calls[0][0];
    expect(createArg.data.encryptedPayload).not.toContain("super-secret-page-token");
  });

  test("transaction rolls back (no pending, no state consumption) when pending creation fails", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "tok", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([discovered()]);
    mockPrisma.pendingPageSelection.create.mockRejectedValue(new Error("DB failure"));

    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "provider_error"
    );
    expect(mockPrisma.oAuthState.update).not.toHaveBeenCalled();
    expect(mockPrisma.oAuthState.updateMany).toHaveBeenCalledWith({
      where: { state: "zzz", consumedAt: null },
      data: { consumedAt: expect.any(Date), encryptedCodeVerifier: null },
    });
    expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
  });

  test("fails safely when discovery returns pages without usable tokens", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "tok", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([
      discovered({ platformAccountId: "", token: { accessToken: "t" } }),
    ]);

    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "pending_no_pages"
    );
    expect(mockPrisma.pendingPageSelection.create).not.toHaveBeenCalled();
  });
});

describe("callback — provider errors map to safe codes", () => {
  test("access_denied with state → oauth_access_denied and record is deleted", async () => {
    const res = await callbackGet(
      makeCallback("error=access_denied&error_code=200&state=zzz")
    );
    const location = res.headers.get("Location") ?? "";
    expect(new URL(location).searchParams.get("connect_error")).toBe("oauth_access_denied");
    expect(location).not.toContain("access_denied_details");
    expect(mockPrisma.oAuthState.delete).toHaveBeenCalledWith({ where: { id: "st_1" } });
  });

  test("generic provider error with state → oauth_denied (never raw strings)", async () => {
    const res = await callbackGet(makeCallback("error=some_internal_detail&state=zzz"));
    const location = res.headers.get("Location") ?? "";
    expect(new URL(location).searchParams.get("connect_error")).toBe("oauth_denied");
    expect(location).not.toContain("some_internal_detail");
  });

  test("logs sanitized provider diagnostics without state or URI query values", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const privateState = "S".repeat(43);
    await callbackGet(
      makeCallback(
        `error=invalid_request&error_description=${encodeURIComponent(`client_secret=credential-value state=${privateState}`)}&error_uri=${encodeURIComponent(`https://api.x.com/errors/invalid?state=${privateState}`)}&state=zzz`
      )
    );
    const logged = JSON.stringify(warning.mock.calls);
    expect(logged).toContain("invalid_request");
    expect(logged).toContain("api.x.com/errors/invalid");
    expect(logged).not.toContain("credential-value");
    expect(logged).not.toContain(privateState);
    expect(logged).not.toContain("state=zzz");
    warning.mockRestore();
  });

  test("exchange failure → structured code and state is consumed", async () => {
    mockProvider.exchangeCode.mockRejectedValue(
      new PublishingError({
        code: "PROVIDER_RATE_LIMITED",
        stage: "PROVIDER_AUTH",
        message: "rate limited by provider",
        retryable: true,
      })
    );
    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "provider_rate_limited"
    );
    expect(mockPrisma.oAuthState.updateMany).toHaveBeenCalledWith({
      where: { state: "zzz", consumedAt: null },
      data: { consumedAt: expect.any(Date), encryptedCodeVerifier: null },
    });
  });
});

describe("callback — workspace scoping, consumption, and leakage", () => {
  test("derives workspace/org/platform from the persisted record, never the query", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "tok", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([discovered()]);

    await callbackGet(makeCallback("platform=INSTAGRAM&code=abc&state=zzz"));

    expect(mockPrisma.organizationMember.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-9", userId: "user-1" },
    });
    const createArg = mockPrisma.pendingPageSelection.create.mock.calls[0][0];
    expect(createArg.data.workspaceId).toBe("ws-9");
    expect(createArg.data.platform).toBe("FACEBOOK");
    expect(createArg.data.organizationId).toBe("org-9");
  });

  test("rejects a user who is not a member of the record's organization", async () => {
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);
    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "not_a_member"
    );
    expect(mockProvider.exchangeCode).not.toHaveBeenCalled();
  });
});

describe("callback — instagram keeps immediate connection", () => {
  beforeEach(() => {
    mockPrisma.oAuthState.findUnique.mockResolvedValue(makeRecord({ platform: "INSTAGRAM" }));
  });

  test("instagram callback creates SocialAccount immediately", async () => {
    mockProvider.exchangeCode.mockResolvedValue({
      accessToken: "ig-short",
      scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
      platformAccountId: "ig_1",
      name: "ZELVOA.IG",
    });
    mockProvider.getAccounts.mockResolvedValue([igDiscovered()]);

    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(res.status).toBe(307);
    expect(res.headers.get("Location") ?? "").toContain("connected=true");
    expect(res.headers.get("Location") ?? "").not.toContain("/app/accounts/select");

    expect(mockPrisma.pendingPageSelection.create).not.toHaveBeenCalled();
    expect(mockPrisma.socialAccount.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockPrisma.socialAccount.upsert.mock.calls[0][0];
    expect(upsertArg.create.platform).toBe("INSTAGRAM");
    expect(upsertArg.create.workspaceId).toBe("ws-9");
    expect(mockPrisma.socialAccountToken.upsert).toHaveBeenCalledTimes(1);
  });

  test("instagram callback consumes the state exactly once", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "ig", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([igDiscovered()]);

    await callbackGet(makeCallback("code=abc&state=zzz"));

    expect(mockPrisma.oAuthState.update).toHaveBeenCalledWith({
      where: { id: "st_1" },
      data: { consumedAt: expect.any(Date), encryptedCodeVerifier: null },
    });
    expect(mockPrisma.oAuthState.update).toHaveBeenCalledTimes(1);
  });

  test("instagram tokens never reach the pending payload", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "ig-token", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([igDiscovered()]);

    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(res.headers.get("Location") ?? "").not.toContain("ig-token");
    expect(mockPrisma.pendingPageSelection.create).not.toHaveBeenCalled();
  });
});

describe("callback — X PKCE connection", () => {
  beforeEach(() => {
    mockPrisma.oAuthState.findUnique.mockResolvedValue(makeRecord({
      platform: "X",
      encryptedCodeVerifier: encryptSecret("pkce-verifier-test"),
    }));
  });

  test("validates persisted PKCE verifier, connects authenticated X profile, and encrypts tokens", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "x-access-secret", refreshToken: "x-refresh-secret", scopes: ["users.read", "tweet.write"], platformAccountId: "x-user-1", name: "X User" });
    mockProvider.getAccounts.mockResolvedValue([{
      platform: "X",
      platformAccountId: "x-user-1",
      name: "X User",
      username: "xuser",
      avatarUrl: null,
      scopes: ["users.read", "tweet.write"],
      status: "CONNECTED",
      token: { accessToken: "x-access-secret", refreshToken: "x-refresh-secret", expiresInSeconds: 7200 },
      isDevProvider: false,
    }]);

    const response = await callbackGet(makeCallback("code=x-code&state=zzz"));
    expect(new URL(response.headers.get("Location") ?? "").searchParams.get("connected")).toBe("true");
    expect(mockProvider.exchangeCode).toHaveBeenCalledWith(
      "x-code",
      "https://zelvoa.vercel.app/api/v1/accounts/oauth/callback",
      "pkce-verifier-test"
    );
    expect(mockPrisma.socialAccount.upsert.mock.calls[0][0].create).toMatchObject({ platform: "X", platformAccountId: "x-user-1", username: "xuser" });
    const tokenData = mockPrisma.socialAccountToken.upsert.mock.calls[0][0].create;
    expect(tokenData.encryptedAccessToken).not.toBe("x-access-secret");
    expect(tokenData.encryptedRefreshToken).not.toBe("x-refresh-secret");
  });
});

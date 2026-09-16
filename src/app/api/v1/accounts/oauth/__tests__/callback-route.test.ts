import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as callbackGet } from "@/app/api/v1/accounts/oauth/callback/route";
import { PublishingError } from "@/lib/publishing/errors";

const TEST_ENCRYPTION_KEY = "a".repeat(64);

const { mockPrisma, mockGetCurrentContext, mockWriteAudit, mockCreateNotification, mockProvider } = vi.hoisted(() => ({
  mockPrisma: {
    oAuthState: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    socialAccount: { upsert: vi.fn() },
    socialAccountToken: { upsert: vi.fn() },
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

const RECORD = {
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
};

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
    scopes: ["pages_manage_posts"],
    status: "CONNECTED",
    token: { accessToken: "long-page-token-value", refreshToken: undefined, expiresInSeconds: null },
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
  mockPrisma.oAuthState.findUnique.mockResolvedValue(RECORD);
  mockPrisma.oAuthState.update.mockResolvedValue({ id: "st_1", consumedAt: new Date() });
  mockPrisma.oAuthState.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.oAuthState.delete.mockResolvedValue({ id: "st_1" });
  mockPrisma.organizationMember.findFirst.mockResolvedValue({ id: "m_1" });
  mockPrisma.socialAccount.upsert.mockImplementation(({ create }) => ({
    id: "acc_1",
    ...create,
    platform: "FACEBOOK",
    platformAccountId: create.platformAccountId,
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
    const location = new URL(res.headers.get("Location") ?? "").toString();
    expect(location).toContain("connected=true");
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

  test("consumed state → oauth_state_already_used", async () => {
    mockPrisma.oAuthState.findUnique.mockResolvedValue({ ...RECORD, consumedAt: new Date() });
    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "oauth_state_already_used"
    );
  });

  test("expired state → oauth_state_expired and the row is removed", async () => {
    mockPrisma.oAuthState.findUnique.mockResolvedValue({
      ...RECORD,
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "oauth_state_expired"
    );
    expect(mockPrisma.oAuthState.delete).toHaveBeenCalledWith({ where: { id: "st_1" } });
  });

  test("valid state proceeds through token exchange and persists the account", async () => {
    mockProvider.exchangeCode.mockResolvedValue({
      accessToken: "short-token",
      refreshToken: undefined,
      expiresInSeconds: 5184000,
      scopes: ["pages_manage_posts"],
      platformAccountId: "profile_1",
    });
    mockProvider.getAccounts.mockResolvedValue([discovered()]);

    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(res.status).toBe(307);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("/app/accounts");
    expect(location).toContain("connected=true");
    expect(mockProvider.exchangeCode).toHaveBeenCalledWith(
      "abc",
      "https://zelvoa.vercel.app/api/v1/accounts/oauth/callback"
    );
    expect(mockPrisma.socialAccountToken.upsert).toHaveBeenCalledTimes(1);
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
      data: { consumedAt: expect.any(Date) },
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
    const upsert = mockPrisma.socialAccount.upsert.mock.calls[0][0];
    expect(upsert.create.workspaceId).toBe("ws-9");
    expect(upsert.create.platform).toBe("FACEBOOK");
  });

  test("consumes the state exactly once on success", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "tok", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([discovered()]);

    await callbackGet(makeCallback("code=abc&state=zzz"));

    expect(mockPrisma.oAuthState.update).toHaveBeenCalledWith({
      where: { id: "st_1" },
      data: { consumedAt: expect.any(Date) },
    });
  });

  test("rejects a user who is not a member of the record's organization", async () => {
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);
    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    expect(new URL(res.headers.get("Location") ?? "").searchParams.get("connect_error")).toBe(
      "not_a_member"
    );
    expect(mockProvider.exchangeCode).not.toHaveBeenCalled();
  });

  test("never exposes state, code, or tokens in the redirect or stored payload", async () => {
    mockProvider.exchangeCode.mockResolvedValue({ accessToken: "short-token", scopes: [] });
    mockProvider.getAccounts.mockResolvedValue([discovered({ token: { accessToken: "super-secret-page-token" } })]);

    const res = await callbackGet(makeCallback("code=abc&state=zzz"));
    const location = res.headers.get("Location") ?? "";
    expect(location).not.toContain("state_consumed");
    expect(location).not.toContain("state=zzz");
    expect(location).not.toContain("code=abc");
    expect(location).not.toContain("super-secret-page-token");
    expect(location).not.toContain("short-token");

    const tokenArgs = mockPrisma.socialAccountToken.upsert.mock.calls[0][0];
    expect(tokenArgs.create.encryptedAccessToken).not.toContain("super-secret-page-token");
    expect(tokenArgs.create.encryptedAccessToken).not.toBe("super-secret-page-token");
  });
});
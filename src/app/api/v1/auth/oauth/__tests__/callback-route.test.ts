import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/v1/auth/oauth/[provider]/callback/route";

const mocks = vi.hoisted(() => ({
  signSession: vi.fn(async () => "mock-token"),
  hashPassword: vi.fn((p: string) => `hash:${p}`),
  exchangeCode: vi.fn(async () => "at-1"),
  fetchProfile: vi.fn(),
  sanitizeNext: vi.fn((next: string | null) => next),
  isLoginProvider: vi.fn((p: string) => ["GOOGLE", "FACEBOOK", "INSTAGRAM", "TIKTOK", "X"].includes(p)),
  syntheticEmail: vi.fn((provider: string, id: string) => `${provider.toLowerCase()}.${id}@social.local`),
  prisma: {
    authOAuthState: {
      findUnique: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    authProviderAccount: {
      findUnique: vi.fn(),
      create: vi.fn(async () => ({ id: "pa-1" })),
    },
    organizationMember: {
      findFirst: vi.fn(async () => ({
        organizationId: "org-1",
        role: "OWNER",
      })),
    },
    workspace: {
      findFirst: vi.fn(async () => ({ id: "ws-1" })),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(async () => ({})),
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
  },
}));

vi.mock("@/lib/social-auth", () => ({
  exchangeCode: mocks.exchangeCode,
  fetchProfile: mocks.fetchProfile,
  isLoginProvider: mocks.isLoginProvider,
  sanitizeNext: mocks.sanitizeNext,
  syntheticEmail: mocks.syntheticEmail,
}));
vi.mock("@/lib/session", () => ({ signSession: mocks.signSession }));
vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/crypto", () => ({ hashPassword: mocks.hashPassword }));

function validState(): {
  id: string;
  state: string;
  provider: string;
  redirectUri: string;
  consumedAt: Date | null;
  expiresAt: Date;
  codeVerifier: string | null;
  next: string | null;
} {
  return {
    id: "st-1",
    state: "state-abc",
    provider: "GOOGLE",
    redirectUri: "https://col.app/api/v1/auth/oauth/google/callback",
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    codeVerifier: null,
    next: "/app/dashboard",
  };
}

const googleProfile = {
  provider: "GOOGLE",
  providerAccountId: "g-1",
  email: "grace@a.com",
  name: "Grace",
  avatarUrl: "https://p/g.png",
  emailVerified: true,
};

async function callCallback(url: string) {
  return GET(new Request(url), {
    params: Promise.resolve({ provider: "google" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchangeCode.mockResolvedValue("at-1");
  mocks.fetchProfile.mockResolvedValue(googleProfile);
  mocks.sanitizeNext.mockImplementation((n: string | null) => n);
  mocks.prisma.authOAuthState.findUnique.mockResolvedValue(validState());
  mocks.prisma.authOAuthState.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.authProviderAccount.findUnique.mockResolvedValue(null);
  mocks.prisma.organizationMember.findFirst.mockResolvedValue({
    organizationId: "org-1",
    role: "OWNER",
  });
  mocks.prisma.workspace.findFirst.mockResolvedValue({ id: "ws-1" });
});

describe("GET /api/v1/auth/oauth/[provider]/callback", () => {
  test("rejects unknown providers", async () => {
    const res = await GET(new Request("https://col.app/x"), {
      params: Promise.resolve({ provider: "github" }),
    });
    expect(res.status).toBe(404);
  });

  test("redirects to login when the user denies", async () => {
    const res = await callCallback(
      "https://col.app/cb?error=access_denied&state=state-abc"
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe(
      "oauth_denied"
    );
  });

  test("signs in an existing connection and sets the session cookie", async () => {
    mocks.prisma.authProviderAccount.findUnique.mockResolvedValue({
      id: "pa-1",
      provider: "GOOGLE",
      providerAccountId: "g-1",
      user: {
        id: "user-1",
        email: "grace@a.com",
        name: "Grace",
        avatarUrl: null,
        deletedAt: null,
      },
    });
    mocks.fetchProfile.mockResolvedValue(googleProfile);

    const res = await callCallback(
      "https://col.app/cb?state=state-abc&code=cd-1"
    );

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/app/dashboard");
    expect(res.cookies.get("zelvoa_session")?.value).toBe("mock-token");
    expect(mocks.signSession).toHaveBeenCalledWith({
      sub: "user-1",
      org: "org-1",
      ws: "ws-1",
      role: "OWNER",
    });
    expect(mocks.prisma.auditLog.create).toHaveBeenCalled();
  });

  test("auto-links a verified email to an existing user", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "user-9",
      email: "grace@a.com",
      name: "Grace",
      avatarUrl: null,
      deletedAt: null,
    });
    mocks.prisma.authProviderAccount.create.mockResolvedValue({ id: "pa-9" });
    mocks.fetchProfile.mockResolvedValue(googleProfile);

    const res = await callCallback(
      "https://col.app/cb?state=state-abc&code=cd-1"
    );

    expect(res.status).toBe(307);
    expect(res.cookies.get("zelvoa_session")?.value).toBe("mock-token");
    expect(mocks.prisma.authProviderAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-9",
        provider: "GOOGLE",
        providerAccountId: "g-1",
      }),
    });
  });

  test("creates a new user for a verified email provider", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.create.mockResolvedValue({
      id: "user-new",
      email: "grace@a.com",
      name: "Grace",
      avatarUrl: "https://p/g.png",
      emailVerified: true,
    });
    mocks.fetchProfile.mockResolvedValue(googleProfile);

    const res = await callCallback(
      "https://col.app/cb?state=state-abc&code=cd-1"
    );

    expect(res.status).toBe(307);
    expect(mocks.prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "grace@a.com",
        passwordHash: expect.stringMatching(/^hash:/),
      }),
    });
    expect(mocks.hashPassword).toHaveBeenCalled();
  });

  test("creates an isolated synthetic identity for email-less providers", async () => {
    mocks.prisma.user.create.mockResolvedValue({
      id: "user-tk",
      email: "tiktok.tk-1@social.local",
      name: "TK",
      avatarUrl: null,
      emailVerified: false,
    });
    mocks.fetchProfile.mockResolvedValue({
      provider: "TIKTOK",
      providerAccountId: "tk-1",
      email: null,
      name: "TK",
      avatarUrl: null,
      emailVerified: false,
    });
    mocks.prisma.authOAuthState.findUnique.mockResolvedValue({
      ...validState(),
      provider: "TIKTOK",
    });

    const res = await GET(new Request("https://col.app/cb?state=state-abc&code=cd-1"), {
      params: Promise.resolve({ provider: "tiktok" }),
    });

    expect(res.status).toBe(307);
    expect(mocks.prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "tiktok.tk-1@social.local",
        passwordHash: expect.stringMatching(/^hash:/),
      }),
    });
  });

  test("conflicts when the verified email is already taken by someone else", async () => {
    // existing connection is null; user.findUnique (same email) returns another account
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "user-other",
      email: "grace@a.com",
      name: "Someone Else",
      avatarUrl: null,
      deletedAt: null,
    });
    // provider account creation fails because a foreign account already owns the email
    mocks.prisma.authProviderAccount.create.mockRejectedValue({ code: "P2002" });
    mocks.fetchProfile.mockResolvedValue(googleProfile);

    const res = await callCallback(
      "https://col.app/cb?state=state-abc&code=cd-1"
    );

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe(
      "oauth_conflict"
    );
    expect(res.cookies.get("zelvoa_session")).toBeUndefined();
  });

  test("rejects reused state", async () => {
    mocks.prisma.authOAuthState.findUnique.mockResolvedValue({
      ...validState(),
      consumedAt: new Date(),
    });
    const res = await callCallback(
      "https://col.app/cb?state=state-abc&code=cd-1"
    );
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe(
      "state_used"
    );
  });

  test("rejects expired state", async () => {
    mocks.prisma.authOAuthState.findUnique.mockResolvedValue({
      ...validState(),
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await callCallback(
      "https://col.app/cb?state=state-abc&code=cd-1"
    );
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe(
      "state_expired"
    );
  });

  test("rejects unknown state", async () => {
    mocks.prisma.authOAuthState.findUnique.mockResolvedValue(null);
    const res = await callCallback(
      "https://col.app/cb?state=state-abc&code=cd-1"
    );
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe(
      "invalid_state"
    );
  });

  test("requires state and code", async () => {
    const noState = await callCallback("https://col.app/cb?code=cd-1");
    expect(new URL(noState.headers.get("location")!).searchParams.get("error")).toBe(
      "invalid_state"
    );

    const noCode = await callCallback("https://col.app/cb?state=state-abc");
    expect(new URL(noCode.headers.get("location")!).searchParams.get("error")).toBe(
      "missing_code"
    );
  });

  test("handles token exchange failures", async () => {
    mocks.exchangeCode.mockRejectedValue(new Error("boom"));
    const res = await callCallback(
      "https://col.app/cb?state=state-abc&code=cd-1"
    );
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe(
      "oauth_failed"
    );
  });

  test("blocks disabled accounts", async () => {
    mocks.fetchProfile.mockResolvedValue(googleProfile);
    mocks.prisma.authProviderAccount.findUnique.mockResolvedValue({
      id: "pa-1",
      provider: "GOOGLE",
      providerAccountId: "g-1",
      user: {
        id: "user-1",
        email: "grace@a.com",
        name: "Grace",
        avatarUrl: null,
        deletedAt: new Date(),
      },
    });
    mocks.fetchProfile.mockResolvedValue(googleProfile);
    const res = await callCallback(
      "https://col.app/cb?state=state-abc&code=cd-1"
    );
    expect(new URL(res.headers.get("location")!).searchParams.get("error")).toBe(
      "account_disabled"
    );
  });
});
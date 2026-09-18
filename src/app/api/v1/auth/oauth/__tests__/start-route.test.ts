import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/v1/auth/oauth/[provider]/route";

const mocks = vi.hoisted(() => ({
  authOAuthStateCreate: vi.fn(async () => ({ id: "row-1" })),
  generateOAuthState: vi.fn(() => "state-abc"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    authOAuthState: {
      create: mocks.authOAuthStateCreate,
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  generateOAuthState: mocks.generateOAuthState,
}));

async function callGet(url: string) {
  return GET(new Request(url), {
    params: Promise.resolve({ provider: "google" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLIENT_ID", "gid");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsec");
});

describe("GET /api/v1/auth/oauth/[provider]", () => {
  test("rejects unknown providers", async () => {
    const res = await GET(new Request("https://col.app/api/v1/auth/oauth/github"), {
      params: Promise.resolve({ provider: "github" }),
    });
    expect(res.status).toBe(404);
  });

  test("redirects to the provider and stores login state", async () => {
    const res = await callGet("https://col.app/api/v1/auth/oauth/google");

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(location.searchParams.get("state")).toBe("state-abc");

    expect(mocks.authOAuthStateCreate).toHaveBeenCalledWith({
      data: {
        provider: "GOOGLE",
        state: "state-abc",
        redirectUri: "https://col.app/api/v1/auth/oauth/google/callback",
        expiresAt: expect.any(Date),
      },
    });
  });

  test("uses PKCE for X", async () => {
    vi.stubEnv("X_CLIENT_ID", "xid");
    vi.stubEnv("X_CLIENT_SECRET", "xsec");
    const res = await GET(new Request("https://col.app/api/v1/auth/oauth/x"), {
      params: Promise.resolve({ provider: "x" }),
    });

    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("code_challenge")).toBeTruthy();
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");

    const calls = mocks.authOAuthStateCreate.mock.calls as unknown as [[{ data: { codeVerifier?: string } }]];
    const createArg = calls[0][0].data;
    expect(createArg.codeVerifier).toBeTruthy();
  });

  test("strips unsafe next values", async () => {
    const res = await callGet(
      "https://col.app/api/v1/auth/oauth/google?next=https://evil.com"
    );
    expect(res.status).toBe(307);
    const calls = mocks.authOAuthStateCreate.mock.calls as unknown as [[{ data: { next?: string } }]];
    const createArg = calls[0][0].data;
    expect(createArg.next).toBeUndefined();
  });
});
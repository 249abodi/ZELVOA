import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/v1/accounts/connect/route";
import { decryptSecret } from "@/lib/crypto";
import { createHash } from "node:crypto";

const { mockPrisma, mockGetCurrentContext, mockWriteAudit } = vi.hoisted(() => ({
  mockPrisma: {
    oAuthState: { create: vi.fn(), delete: vi.fn() },
    socialAccountToken: { upsert: vi.fn() },
  },
  mockGetCurrentContext: vi.fn(),
  mockWriteAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: () => mockGetCurrentContext() }));
vi.mock("@/lib/audit", () => ({ writeAudit: (...args: unknown[]) => mockWriteAudit(...args) }));

const CONTEXT = {
  user: { id: "user-1", email: "a@b.co", name: "A User", avatarUrl: null },
  organization: { id: "org-9", name: "Org", slug: "org", timezone: "UTC" },
  workspace: { id: "ws-9", name: "Workspace", slug: "ws", timezone: "UTC" },
  role: "OWNER",
};

function connectRequest(platform = "FACEBOOK"): Request {
  return new Request("https://zelvoa.vercel.app/api/v1/accounts/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://zelvoa.vercel.app");
  vi.stubEnv("FACEBOOK_CLIENT_ID", "fb-id");
  vi.stubEnv("FACEBOOK_CLIENT_SECRET", "fb-secret");
  vi.stubEnv("X_CLIENT_ID", "x-id");
  vi.stubEnv("X_CLIENT_SECRET", "x-secret");
  vi.stubEnv("ENCRYPTION_KEY", "a".repeat(64));
  mockGetCurrentContext.mockResolvedValue(CONTEXT);
  mockWriteAudit.mockResolvedValue(true);
  mockPrisma.oAuthState.create.mockImplementation(({ data }) => ({ id: "st_new", ...data }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("connect route — OAuth state lifecycle", () => {
  test("generates a non-empty state, persists it, and embeds it in the authorization URL", async () => {
    const res = await POST(connectRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data).toMatchObject({ status: "ready", canConnect: true });
    expect(body.data.state).toBeTruthy();
    expect(body.data.state.length).toBeGreaterThanOrEqual(32);

    const url = new URL(body.data.authorizationUrl);
    expect(url.searchParams.get("state")).toBe(body.data.state);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://zelvoa.vercel.app/api/v1/accounts/oauth/callback"
    );
    expect(url.searchParams.get("config_id")).toBe("1622667325887896");
    expect(url.searchParams.get("override_default_response_type")).toBe("true");
    expect(url.searchParams.get("scope")).toBeNull();

    expect(mockPrisma.oAuthState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-9",
        workspaceId: "ws-9",
        platform: "FACEBOOK",
        state: body.data.state,
        redirectUri: "https://zelvoa.vercel.app/api/v1/accounts/oauth/callback",
      }),
    });
  });

  test("the persisted state and the URL state are the same value", async () => {
    const res = await POST(connectRequest());
    const body = await res.json();
    const createCall = mockPrisma.oAuthState.create.mock.calls[0][0];
    expect(createCall.data.state).toBe(new URL(body.data.authorizationUrl).searchParams.get("state"));
  });

  test("uses a fresh state for every attempt (one-time-use by construction)", async () => {
    const [a, b] = await Promise.all([POST(connectRequest()), POST(connectRequest())]);
    const [jsonA, jsonB] = await Promise.all([a.json(), b.json()]);
    expect(jsonA.data.state).toHaveLength(32);
    expect(jsonB.data.state).toHaveLength(32);
    expect(jsonA.data.state).not.toBe(jsonB.data.state);
    expect(mockPrisma.oAuthState.create).toHaveBeenCalledTimes(2);
  });

  test("never returns the client secret in the response", async () => {
    const res = await POST(connectRequest());
    const raw = await res.text();
    expect(raw).not.toContain("fb-secret");
  });

  test("returns not_configured when credentials are missing and never creates state", async () => {
    vi.stubEnv("FACEBOOK_CLIENT_ID", "");
    vi.stubEnv("FACEBOOK_CLIENT_SECRET", "");

    const res = await POST(connectRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ status: "not_configured", canConnect: false });
    expect(mockPrisma.oAuthState.create).not.toHaveBeenCalled();
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  test("rejects unauthorized callers before creating OAuth state", async () => {
    mockGetCurrentContext.mockResolvedValue(null);
    const res = await POST(connectRequest("X"));
    expect(res.status).toBe(401);
    expect(mockPrisma.oAuthState.create).not.toHaveBeenCalled();
  });

  test("creates X PKCE authorization and encrypts the verifier in OAuth state", async () => {
    const res = await POST(connectRequest("X"));
    const raw = await res.text();
    const body = JSON.parse(raw) as { data: { authorizationUrl: string } };
    const url = new URL(body.data.authorizationUrl);
    const stored = mockPrisma.oAuthState.create.mock.calls[0][0].data;
    const verifier = decryptSecret(stored.encryptedCodeVerifier);
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    expect(url.searchParams.get("code_challenge")).toBe(challenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("offline.access");
    expect(stored.encryptedCodeVerifier).not.toContain(verifier);
    expect(raw).not.toContain("x-secret");
  });

  test("X stays unavailable when either required credential is missing", async () => {
    vi.stubEnv("X_CLIENT_SECRET", "");
    const res = await POST(connectRequest("X"));
    expect((await res.json()).data).toMatchObject({ status: "not_configured", canConnect: false });
    expect(mockPrisma.oAuthState.create).not.toHaveBeenCalled();
  });
});

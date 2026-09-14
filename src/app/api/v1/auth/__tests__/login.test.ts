import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/v1/auth/login/route";
import { hashPassword } from "@/lib/crypto";
import { SESSION_COOKIE } from "@/lib/auth";
import { verifySession } from "@/lib/session";

const TEST_SECRET = "test-only-secret-do-not-use-0123456789abcdef";
const PASSWORD = "correct-horse-battery-staple";
const PASSWORD_HASH = hashPassword(PASSWORD);

const { mockPrisma, mockCheckAuthRateLimit } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findFirst: vi.fn(),
    },
    workspace: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
  mockCheckAuthRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth-rate-limit", () => ({
  checkAuthRateLimit: (...args: unknown[]) => mockCheckAuthRateLimit(...args),
}));

const USER = {
  id: "user-1",
  email: "a@b.co",
  name: "A User",
  passwordHash: PASSWORD_HASH,
};

const MEMBERSHIP = { organizationId: "org-1", role: "OWNER" };
const WORKSPACE = { id: "ws-1" };

function makeLoginRequest(password: string): Request {
  return new Request("http://localhost/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "A@B.CO", password }),
  });
}

function cookieToken(res: Response): string | null {
  const setCookie = Array.isArray(res.headers.getSetCookie)
    ? res.headers.getSetCookie().join("; ")
    : (res.headers.get("set-cookie") ?? "");
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_SECRET", TEST_SECRET);
  mockCheckAuthRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  mockPrisma.user.findUnique.mockResolvedValue(USER);
  mockPrisma.user.update.mockResolvedValue(USER);
  mockPrisma.organizationMember.findFirst.mockResolvedValue(MEMBERSHIP);
  mockPrisma.workspace.findFirst.mockResolvedValue(WORKSPACE);
  mockPrisma.auditLog.create.mockResolvedValue({ id: "log-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("login route", () => {
  test("succeeds, signs a session cookie, and does not regress", async () => {
    const res = await POST(makeLoginRequest(PASSWORD));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual({
      data: {
        user: { id: "user-1", email: "a@b.co", name: "A User" },
        organizationId: "org-1",
        workspaceId: "ws-1",
        role: "OWNER",
      },
    });

    const token = cookieToken(res);
    expect(token).toBeTruthy();
    const decoded = await verifySession(token as string);
    expect(decoded).toEqual({ sub: "user-1", org: "org-1", ws: "ws-1", role: "OWNER" });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: "user-1", action: "auth.login" }),
    });
  });

  test("rejects an invalid password", async () => {
    const res = await POST(makeLoginRequest("wrong-password"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe("Invalid email or password.");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test("rejects an unknown email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeLoginRequest(PASSWORD));
    expect(res.status).toBe(401);
  });

  test("fails closed when AUTH_SECRET is missing and never leaks the secret", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("AUTH_SECRET", "");

    const res = await POST(makeLoginRequest(PASSWORD));
    expect(res.status).toBe(500);
    const raw = await res.text();
    expect(raw).not.toContain(TEST_SECRET);
    expect(raw).not.toContain("AUTH_SECRET is not configured");

    for (const call of errorSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(TEST_SECRET);
    }
    expect(errorSpy).toHaveBeenCalledWith("[api]", expect.any(Error));
    errorSpy.mockRestore();
  });

  test("respects the auth rate limit", async () => {
    mockCheckAuthRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 45 });
    const res = await POST(makeLoginRequest(PASSWORD));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
  });
});

describe("login env safety", () => {
  test("the test secret used here is never a production value and never in responses", async () => {
    const res = await POST(makeLoginRequest(PASSWORD));
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain(TEST_SECRET);
  });
});
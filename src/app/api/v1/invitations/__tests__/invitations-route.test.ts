import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as createInvite } from "@/app/api/v1/invitations/route";
import { POST as acceptInvite } from "@/app/api/v1/invitations/accept/route";
import { POST as revokeInvite } from "@/app/api/v1/invitations/revoke/route";
import { generateInviteToken, hashInviteToken } from "@/lib/invitations";

const txClient = {
  invitation: {
    update: vi.fn(),
  },
  organizationMember: {
    update: vi.fn(),
    create: vi.fn(),
  },
  user: { create: vi.fn() },
  userSettings: { create: vi.fn() },
  organization: { create: vi.fn() },
  workspace: { create: vi.fn() },
  plan: { findUnique: vi.fn() },
  subscription: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};

const { mockPrisma, mockContext, mockCan, mockWriteAudit, mockUsage, mockPlan } = vi.hoisted(() => ({
  mockPrisma: {
    organizationMember: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    invitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    oAuthState: { create: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
  mockContext: vi.fn(),
  mockCan: vi.fn(),
  mockWriteAudit: vi.fn(),
  mockUsage: vi.fn(),
  mockPlan: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({
  getCurrentContext: () => mockContext(),
  SESSION_COOKIE: "zelvoa_session",
}));
vi.mock("@/lib/rbac", () => ({
  can: (...a: unknown[]) => mockCan(...a),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => mockWriteAudit(...a) }));
vi.mock("@/lib/billing/limits", () => ({
  getEffectivePlan: () => mockPlan(),
  getUsageSnapshot: () => mockUsage(),
}));

const CONTEXT = {
  user: { id: "user-1", email: "owner@a.co", name: "Owner", avatarUrl: null },
  organization: { id: "org-1", name: "Org", slug: "org", timezone: "UTC" },
  workspace: { id: "ws-1", name: "WS", slug: "ws", timezone: "UTC" },
  role: "OWNER",
};

const VALID_BODY = { email: "new@member.co", role: "VIEWER" };

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockContext.mockResolvedValue(CONTEXT);
  mockCan.mockReturnValue(true);
  mockWriteAudit.mockResolvedValue(undefined);
  mockUsage.mockResolvedValue({ teamMembers: 1 });
  mockPlan.mockResolvedValue({ maxTeamMembers: 5 });
  mockPrisma.organizationMember.findFirst.mockResolvedValue(null);
  mockPrisma.invitation.findFirst.mockResolvedValue(null);
  mockPrisma.invitation.count.mockResolvedValue(0);
  mockPrisma.invitation.create.mockResolvedValue({
    id: "inv-1",
    email: "new@member.co",
    role: "VIEWER",
    status: "PENDING",
    expiresAt: new Date(),
  });
  mockPrisma.invitation.update.mockResolvedValue({ id: "inv-1", status: "ACCEPTED" });
  mockPrisma.workspace.findUnique.mockResolvedValue({ id: "ws-1" });
  mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(txClient));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("invitations create", () => {
  test("rejects unauthenticated requests", async () => {
    mockContext.mockResolvedValue(null);
    const res = await createInvite(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  test("rejects users without the member.invite permission", async () => {
    mockCan.mockReturnValue(false);
    const res = await createInvite(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  test("creates an invitation with a hashed token and returns a shareable link", async () => {
    const res = await createInvite(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.data.inviteUrl).toMatch(/^http:\/\/localhost\/invite\?token=/);
    expect(json.data.invitation.email).toBe("new@member.co");
    expect(json.data.invitation.role).toBe("VIEWER");

    const url = new URL(json.data.inviteUrl);
    const rawToken = url.searchParams.get("token") as string;
    expect(rawToken).toBeTruthy();

    const created = mockPrisma.invitation.create.mock.calls[0][0];
    expect(created.data.tokenHash).toBe(hashInviteToken(rawToken));
    expect(created.data.tokenHash).not.toBe(rawToken);
    expect(json.data.inviteUrl).not.toContain(created.data.tokenHash);
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.invited" })
    );
  });

  test("rejects a duplicate active member", async () => {
    mockPrisma.organizationMember.findFirst.mockResolvedValue({
      id: "m-1",
      status: "ACTIVE",
    });
    const res = await createInvite(jsonRequest(VALID_BODY));
    expect(res.status).toBe(409);
    expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
  });

  test("rejects a duplicate pending invitation", async () => {
    mockPrisma.invitation.findFirst.mockResolvedValue({ id: "inv-x" });
    const res = await createInvite(jsonRequest(VALID_BODY));
    expect(res.status).toBe(409);
    expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
  });

  test("rejects an invalid role for invitation", async () => {
    const res = await createInvite(jsonRequest({ email: "a@b.co", role: "OWNER" }));
    expect(res.status).toBe(422);
    expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
  });

  test("enforces the plan team-member limit", async () => {
    mockPlan.mockResolvedValue({ maxTeamMembers: 2 });
    mockUsage.mockResolvedValue({ teamMembers: 2 });
    const res = await createInvite(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
  });

  test("never exposes the raw token or hash in the response", async () => {
    const res = await createInvite(jsonRequest(VALID_BODY));
    const raw = await res.text();
    expect(raw).not.toContain("tokenHash");
    expect(raw).not.toContain("user-1");
  });
});

describe("invitations accept", () => {
  const acceptedToken = generateInviteToken();

  beforeEach(() => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      organizationId: "org-1",
      workspaceId: "ws-1",
      email: "existing@member.co",
      role: "ADMIN",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      tokenHash: hashInviteToken(acceptedToken),
    });
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);
  });

  function acceptRequest(token: string): Request {
    return new Request("http://localhost/api/v1/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  }

  test("accepts a valid invitation for the invited email and re-issues the session", async () => {
    mockContext.mockResolvedValue({
      ...CONTEXT,
      user: { ...CONTEXT.user, email: "existing@member.co" },
    });

    const res = await acceptInvite(acceptRequest(acceptedToken));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({
      organizationId: "org-1",
      workspaceId: "ws-1",
      role: "ADMIN",
    });

    const setCookie = Array.isArray(res.headers.getSetCookie)
      ? res.headers.getSetCookie().join("; ")
      : (res.headers.get("set-cookie") ?? "");
    expect(setCookie).toContain("zelvoa_session=");
    expect(json.raw).toBeUndefined();
  });

  test("rejects an invitation addressed to a different email (account-takeover guard)", async () => {
    mockContext.mockResolvedValue({
      ...CONTEXT,
      user: { ...CONTEXT.user, email: "attacker@a.co" },
    });
    const res = await acceptInvite(acceptRequest(acceptedToken));
    expect(res.status).toBe(403);
    expect(mockPrisma.invitation.update).not.toHaveBeenCalled();
  });

  test("rejects an unknown token", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(null);
    mockContext.mockResolvedValue({
      ...CONTEXT,
      user: { ...CONTEXT.user, email: "existing@member.co" },
    });
    const res = await acceptInvite(acceptRequest(generateInviteToken()));
    expect(res.status).toBe(404);
  });

  test("rejects an expired invitation", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      organizationId: "org-1",
      workspaceId: "ws-1",
      email: "existing@member.co",
      role: "ADMIN",
      status: "PENDING",
      expiresAt: new Date(Date.now() - 1000),
    });
    mockContext.mockResolvedValue({
      ...CONTEXT,
      user: { ...CONTEXT.user, email: "existing@member.co" },
    });
    const res = await acceptInvite(acceptRequest(acceptedToken));
    expect(res.status).toBe(404);
  });

  test("consumes the invitation so reused tokens are rejected", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      organizationId: "org-1",
      workspaceId: "ws-1",
      email: "existing@member.co",
      role: "ADMIN",
      status: "ACCEPTED",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    mockContext.mockResolvedValue({
      ...CONTEXT,
      user: { ...CONTEXT.user, email: "existing@member.co" },
    });
    const res = await acceptInvite(acceptRequest(acceptedToken));
    expect(res.status).toBe(404);
    expect(mockPrisma.invitation.update).not.toHaveBeenCalled();
  });

  test("requires authentication", async () => {
    mockContext.mockResolvedValue(null);
    const res = await acceptInvite(acceptRequest(acceptedToken));
    expect(res.status).toBe(401);
  });
});

describe("invitations revoke", () => {
  beforeEach(() => {
    mockPrisma.invitation.findFirst.mockResolvedValue({
      id: "inv-1",
      email: "a@b.co",
      workspaceId: "ws-1",
    });
    mockPrisma.invitation.update.mockResolvedValue({ id: "inv-1", status: "REVOKED" });
  });

  test("revokes a pending invitation in the same org", async () => {
    const res = await revokeInvite(
      new Request("http://localhost/api/v1/invitations/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "inv-1" }),
      })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REVOKED" }) })
    );
  });

  test("rejects revoking without the member.invite permission", async () => {
    mockCan.mockReturnValue(false);
    const res = await revokeInvite(
      new Request("http://localhost/api/v1/invitations/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "inv-1" }),
      })
    );
    expect(res.status).toBe(403);
  });
});
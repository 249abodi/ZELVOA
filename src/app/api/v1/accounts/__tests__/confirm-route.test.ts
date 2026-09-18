import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/v1/accounts/confirm/route";
import { buildPendingPayload } from "@/lib/pending-selection";

const TEST_ENCRYPTION_KEY = "a".repeat(64);

const { mockPrisma, mockGetCurrentContext, mockWriteAudit, mockCreateNotification } = vi.hoisted(() => ({
  mockPrisma: {
    pendingPageSelection: { delete: vi.fn() },
    socialAccount: { upsert: vi.fn() },
    socialAccountToken: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  mockGetCurrentContext: vi.fn(),
  mockWriteAudit: vi.fn(),
  mockCreateNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: () => mockGetCurrentContext() }));
vi.mock("@/lib/audit", () => ({ writeAudit: (...args: unknown[]) => mockWriteAudit(...args) }));
vi.mock("@/lib/notifications/service", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

const CONTEXT = {
  user: { id: "user-1", email: "a@b.co", name: "A User", avatarUrl: null },
  organization: { id: "org-9", name: "Org", slug: "org", timezone: "UTC" },
  workspace: { id: "ws-9", name: "Workspace", slug: "ws", timezone: "UTC" },
  role: "OWNER",
};

function payload(pages: Array<{ pageId: string; name: string }>) {
  return buildPendingPayload({
    scopes: ["pages_manage_posts", "pages_show_list"],
    isDev: false,
    pages: pages.map((p) => ({
      pageId: p.pageId,
      name: p.name,
      username: p.pageId,
      avatarUrl: null,
      accessToken: `page-token-${p.pageId}`,
    })),
  });
}

function pendingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "pp_1",
    oauthStateId: "st_1",
    workspaceId: "ws-9",
    organizationId: "org-9",
    userId: "user-1",
    platform: "FACEBOOK",
    encryptedPayload: payload([{ pageId: "page_1", name: "ZELVOA" }, { pageId: "page_2", name: "Second Page" }]),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}

function confirmRequest(body: unknown): Request {
  return new Request("https://zelvoa.vercel.app/api/v1/accounts/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
  mockGetCurrentContext.mockResolvedValue(CONTEXT);
  mockWriteAudit.mockResolvedValue(true);
  mockCreateNotification.mockResolvedValue(true);
  mockPrisma.pendingPageSelection.delete.mockImplementation(async ({ where }) => {
    if (where.id === "missing") {
      throw Object.assign(new Error("Record not found"), { code: "P2025" });
    }
    return pendingRecord();
  });
  mockPrisma.socialAccount.upsert.mockImplementation(({ create }) => ({
    id: `acc_${create.platformAccountId}`,
    ...create,
  }));
  mockPrisma.socialAccountToken.upsert.mockResolvedValue({ id: "tok_1" });
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockPrisma));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/v1/accounts/confirm", () => {
  test("unauthenticated → 401", async () => {
    mockGetCurrentContext.mockResolvedValue(null);
    const res = await POST(confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_1"] }));
    expect(res.status).toBe(401);
  });

  test("rejects an empty selection", async () => {
    const res = await POST(confirmRequest({ pendingId: "pp_1", selectedPageIds: [] }));
    expect(res.status).toBe(422);
  });

  test("rejects missing pendingId", async () => {
    const res = await POST(confirmRequest({ selectedPageIds: ["page_1"] }));
    expect(res.status).toBe(422);
  });

  test("rejects duplicate selections", async () => {
    const res = await POST(
      confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_1", "page_1"] })
    );
    expect(res.status).toBe(422);
  });

  test("creates SocialAccount and encrypted SocialAccountToken for the selected Page only", async () => {
    const res = await POST(confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_2"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ connected: true, accounts: 1 });

    expect(mockPrisma.socialAccount.upsert).toHaveBeenCalledTimes(1);
    const accountArg = mockPrisma.socialAccount.upsert.mock.calls[0][0];
    expect(accountArg.create).toMatchObject({
      workspaceId: "ws-9",
      platform: "FACEBOOK",
      platformAccountId: "page_2",
      name: "Second Page",
      status: "CONNECTED",
    });
    expect(accountArg.create.scopes).toEqual(["pages_manage_posts", "pages_show_list"]);

    expect(mockPrisma.socialAccountToken.upsert).toHaveBeenCalledTimes(1);
    const tokenArg = mockPrisma.socialAccountToken.upsert.mock.calls[0][0];
    expect(tokenArg.create.encryptedAccessToken).not.toBe("page-token-page_2");
    expect(tokenArg.create.encryptedAccessToken).not.toContain("page-token-page_2");
    expect(tokenArg.create.socialAccountId).toBe("acc_page_2");
  });

  test("unselected Page is not connected", async () => {
    const res = await POST(confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_1"] }));
    expect(res.status).toBe(200);
    expect(mockPrisma.socialAccount.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.socialAccount.upsert.mock.calls[0][0].create.platformAccountId).toBe("page_1");
  });

  test("rejects an unknown Page ID not present in the payload", async () => {
    const res = await POST(
      confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_1", "page_999"] })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toBe("pending_invalid_selection");
    expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
  });

  test("rejects an expired pending", async () => {
    mockPrisma.pendingPageSelection.delete.mockResolvedValue(
      pendingRecord({ expiresAt: new Date(Date.now() - 1000) })
    );
    const res = await POST(confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_1"] }));
    expect(res.status).toBe(410);
    expect((await res.json()).error.message).toBe("pending_expired");
    expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
  });

  test("rejects a pending belonging to another user", async () => {
    mockPrisma.pendingPageSelection.delete.mockResolvedValue(
      pendingRecord({ userId: "other-user" })
    );
    const res = await POST(confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_1"] }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toBe("pending_unauthorized");
    expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
  });

  test("rejects a pending belonging to another workspace", async () => {
    mockPrisma.pendingPageSelection.delete.mockResolvedValue(
      pendingRecord({ workspaceId: "ws-other" })
    );
    const res = await POST(confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_1"] }));
    expect(res.status).toBe(403);
  });

  test("fails safely and does not leak raw tokens when store fails and rolls back the pending deletion", async () => {
    mockPrisma.socialAccountToken.upsert.mockRejectedValue(new Error("DB write failed"));
    const res = await POST(confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_1"] }));
    expect(res.status).toBe(500);
    const raw = await res.text();
    expect(raw).not.toContain("page-token-page_1");
    expect(mockPrisma.pendingPageSelection.delete).toHaveBeenCalledWith({ where: { id: "pp_1" } });
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  test("double-confirm (pending already consumed) resolves as already completed without duplicates", async () => {
    const res = await POST(confirmRequest({ pendingId: "missing", selectedPageIds: ["page_1"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ connected: false, alreadyCompleted: true });
    expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
  });

  test("writes audit log and notification for each connected account", async () => {
    const res = await POST(
      confirmRequest({ pendingId: "pp_1", selectedPageIds: ["page_1", "page_2"] })
    );
    expect(res.status).toBe(200);

    expect(mockWriteAudit).toHaveBeenCalledTimes(2);
    const auditArg = mockWriteAudit.mock.calls[0][0];
    expect(auditArg).toMatchObject({
      organizationId: "org-9",
      workspaceId: "ws-9",
      actorId: "user-1",
      action: "account.connected",
      entityType: "SocialAccount",
      metadata: { platform: "FACEBOOK", isDev: false },
    });
    expect(auditArg.metadata).not.toHaveProperty("accessToken");

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
  });
});
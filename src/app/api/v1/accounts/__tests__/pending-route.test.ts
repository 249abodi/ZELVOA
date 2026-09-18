import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/v1/accounts/pending/[pendingId]/route";
import { buildPendingPayload } from "@/lib/pending-selection";

const TEST_ENCRYPTION_KEY = "a".repeat(64);

const { mockPrisma, mockGetCurrentContext } = vi.hoisted(() => ({
  mockPrisma: {
    pendingPageSelection: { findUnique: vi.fn(), deleteMany: vi.fn() },
    socialAccount: { findMany: vi.fn() },
  },
  mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: () => mockGetCurrentContext() }));

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

function pendingRequest(pendingId = "pp_1"): Request {
  return new Request(`https://zelvoa.vercel.app/api/v1/accounts/pending/${pendingId}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
  mockGetCurrentContext.mockResolvedValue(CONTEXT);
  mockPrisma.pendingPageSelection.findUnique.mockResolvedValue(pendingRecord());
  mockPrisma.pendingPageSelection.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.socialAccount.findMany.mockResolvedValue([{ platformAccountId: "page_2" }]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/v1/accounts/pending/[pendingId]", () => {
  test("unauthenticated → 401", async () => {
    mockGetCurrentContext.mockResolvedValue(null);
    const res = await GET(pendingRequest(), { params: Promise.resolve({ pendingId: "pp_1" }) });
    expect(res.status).toBe(401);
  });

  test("without a workspace → 400", async () => {
    mockGetCurrentContext.mockResolvedValue({ ...CONTEXT, workspace: null });
    const res = await GET(pendingRequest(), { params: Promise.resolve({ pendingId: "pp_1" }) });
    expect(res.status).toBe(400);
  });

  test("missing pending → 404 pending_not_found", async () => {
    mockPrisma.pendingPageSelection.findUnique.mockResolvedValue(null);
    const res = await GET(pendingRequest(), { params: Promise.resolve({ pendingId: "nope" }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe("pending_not_found");
  });

  test("expired pending → 410, deleted safely, no payload leaked", async () => {
    mockPrisma.pendingPageSelection.findUnique.mockResolvedValue(
      pendingRecord({ expiresAt: new Date(Date.now() - 1000) })
    );
    const res = await GET(pendingRequest(), { params: Promise.resolve({ pendingId: "pp_1" }) });
    expect(res.status).toBe(410);
    expect((await res.json()).error.message).toBe("pending_expired");
    expect(mockPrisma.pendingPageSelection.deleteMany).toHaveBeenCalledWith({
      where: { id: "pp_1" },
    });
  });

  test("pending owned by another user → 403", async () => {
    mockPrisma.pendingPageSelection.findUnique.mockResolvedValue(
      pendingRecord({ userId: "other-user" })
    );
    const res = await GET(pendingRequest(), { params: Promise.resolve({ pendingId: "pp_1" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toBe("pending_unauthorized");
  });

  test("pending in another workspace → 403", async () => {
    mockPrisma.pendingPageSelection.findUnique.mockResolvedValue(
      pendingRecord({ workspaceId: "ws-other" })
    );
    const res = await GET(pendingRequest(), { params: Promise.resolve({ pendingId: "pp_1" }) });
    expect(res.status).toBe(403);
  });

  test("pending in another organization → 403", async () => {
    mockPrisma.pendingPageSelection.findUnique.mockResolvedValue(
      pendingRecord({ organizationId: "org-other" })
    );
    const res = await GET(pendingRequest(), { params: Promise.resolve({ pendingId: "pp_1" }) });
    expect(res.status).toBe(403);
  });

  test("authorized user retrieves only safe page metadata with server-side alreadyConnected", async () => {
    const res = await GET(pendingRequest(), { params: Promise.resolve({ pendingId: "pp_1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pages).toHaveLength(2);
    expect(body.data.pages[0]).toEqual({
      pageId: "page_1",
      name: "ZELVOA",
      username: "page_1",
      avatarUrl: null,
      alreadyConnected: false,
    });
    expect(body.data.pages[1].alreadyConnected).toBe(true);
    expect(mockPrisma.socialAccount.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-9",
        platform: "FACEBOOK",
        platformAccountId: { in: ["page_1", "page_2"] },
      },
      select: { platformAccountId: true },
    });
  });

  test("response never contains access tokens or the encrypted payload", async () => {
    const res = await GET(pendingRequest(), { params: Promise.resolve({ pendingId: "pp_1" }) });
    const raw = await res.text();
    expect(raw).not.toContain("page-token-page_1");
    expect(raw).not.toContain("page-token-page_2");
    expect(raw).not.toContain("oauthStateId");
    expect(raw).not.toContain("st_1");
  });
});
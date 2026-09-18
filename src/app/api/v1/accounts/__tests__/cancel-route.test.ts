import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/v1/accounts/cancel/route";

const { mockPrisma, mockGetCurrentContext } = vi.hoisted(() => ({
  mockPrisma: {
    pendingPageSelection: { deleteMany: vi.fn() },
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

function cancelRequest(body: unknown): Request {
  return new Request("https://zelvoa.vercel.app/api/v1/accounts/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentContext.mockResolvedValue(CONTEXT);
  mockPrisma.pendingPageSelection.deleteMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/v1/accounts/cancel", () => {
  test("unauthenticated → 401", async () => {
    mockGetCurrentContext.mockResolvedValue(null);
    const res = await POST(cancelRequest({ pendingId: "pp_1" }));
    expect(res.status).toBe(401);
  });

  test("requires a pendingId", async () => {
    const res = await POST(cancelRequest({}));
    expect(res.status).toBe(422);
  });

  test("owner can cancel their pending selection", async () => {
    const res = await POST(cancelRequest({ pendingId: "pp_1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ cancelled: true });
    expect(mockPrisma.pendingPageSelection.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "pp_1",
        userId: "user-1",
        workspaceId: "ws-9",
        organizationId: "org-9",
      },
    });
  });

  test("pending not found / not owned / wrong workspace is safely reported as not found without leaking", async () => {
    mockPrisma.pendingPageSelection.deleteMany.mockResolvedValue({ count: 0 });
    const res = await POST(cancelRequest({ pendingId: "pp_unknown" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe("pending_not_found");
  });

  test("always scopes the deletion to the authenticated user and workspace", async () => {
    await POST(cancelRequest({ pendingId: "pp_1" }));
    const where = mockPrisma.pendingPageSelection.deleteMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: "pp_1", userId: "user-1", workspaceId: "ws-9" });
  });
});
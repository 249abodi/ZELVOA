import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/accounts/[id]/disconnect/route";
import { encryptSecret } from "@/lib/crypto";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    findFirst: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    getCurrentContext: vi.fn(),
    revoke: vi.fn(),
    writeAudit: vi.fn(),
    createNotification: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    socialAccount: { findFirst: mocks.findFirst, update: mocks.update },
    socialAccountToken: { deleteMany: mocks.deleteMany },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentContext: () => mocks.getCurrentContext() }));
vi.mock("@/lib/integrations/factory", () => ({ getProvider: () => ({ revoke: mocks.revoke }) }));
vi.mock("@/lib/audit", () => ({ writeAudit: (...args: unknown[]) => mocks.writeAudit(...args) }));
vi.mock("@/lib/notifications/service", () => ({ createNotification: (...args: unknown[]) => mocks.createNotification(...args) }));

const context = {
  user: { id: "user-1" },
  organization: { id: "org-1" },
  workspace: { id: "workspace-1" },
  role: "OWNER",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ENCRYPTION_KEY", "a".repeat(64));
  mocks.getCurrentContext.mockResolvedValue(context);
  mocks.findFirst.mockResolvedValue({
    id: "account-1",
    platform: "X",
    name: "Test X account",
    scopes: ["users.read", "offline.access"],
    token: {
      encryptedAccessToken: encryptSecret("access-token"),
      encryptedRefreshToken: encryptSecret("refresh-token"),
    },
  });
  mocks.update.mockResolvedValue({});
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.revoke.mockResolvedValue(undefined);
  mocks.writeAudit.mockResolvedValue(true);
  mocks.createNotification.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/v1/accounts/:id/disconnect", () => {
  it("revokes both X tokens and removes local token storage", async () => {
    const response = await POST(new Request("https://app.example/api"), { params: Promise.resolve({ id: "account-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.revoke).toHaveBeenCalledWith("access-token", "refresh-token");
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "account-1" }, data: { status: "DISCONNECTED", lastSyncAt: null } });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { socialAccountId: "account-1" } });
  });

  it("rejects unauthorized callers before accessing the account", async () => {
    mocks.getCurrentContext.mockResolvedValue(null);
    const response = await POST(new Request("https://app.example/api"), { params: Promise.resolve({ id: "account-1" }) });
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

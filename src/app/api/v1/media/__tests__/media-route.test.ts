import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/v1/media/route";

const { mockPrisma, mockContext, mockCan, mockWriteAudit, mockStorage, mockQuota, mockThumb } = vi.hoisted(() => ({
  mockPrisma: {
    mediaFolder: { findFirst: vi.fn() },
    mediaAsset: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
  mockContext: vi.fn(),
  mockCan: vi.fn(),
  mockWriteAudit: vi.fn(),
  mockStorage: {
    name: "mock",
    put: vi.fn(),
  },
  mockQuota: vi.fn(),
  mockThumb: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: () => mockContext() }));
vi.mock("@/lib/rbac", () => ({ can: (...a: unknown[]) => mockCan(...a) }));
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => mockWriteAudit(...a) }));
vi.mock("@/lib/storage/factory", () => ({ getStorage: () => mockStorage }));
vi.mock("@/lib/storage/quota", () => ({
  MAX_FILE_BYTES: 50 * 1024 * 1024,
  assertStorageQuotaAvailable: (...a: unknown[]) => mockQuota(...a),
}));
vi.mock("@/lib/storage/thumbnails", () => ({
  isImageMime: () => false,
  generateThumbnail: (...a: unknown[]) => mockThumb(...a),
}));

const CONTEXT = {
  user: { id: "user-1", email: "a@b.co", name: "A User", avatarUrl: null },
  organization: { id: "org-1", name: "Org", slug: "org", timezone: "UTC" },
  workspace: { id: "ws-1", name: "WS", slug: "ws", timezone: "UTC" },
  role: "OWNER",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockContext.mockResolvedValue(CONTEXT);
  mockCan.mockReturnValue(true);
  mockWriteAudit.mockResolvedValue(undefined);
  mockQuota.mockResolvedValue(undefined);
  mockStorage.put.mockResolvedValue({ sizeBytes: 4, checksum: "abc123" });
  mockPrisma.mediaFolder.findFirst.mockResolvedValue({ id: "folder-1" });
  mockPrisma.mediaAsset.create.mockResolvedValue({
    id: "asset-1",
    fileName: "hello.txt",
    mimeType: "text/plain",
    sizeBytes: 4,
    type: "DOCUMENT",
    storageProvider: "mock",
    storageKey: "ws-1/key",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function uploadRequest(files: File[], extra?: { folderId?: string }): Request {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (extra?.folderId) form.set("folderId", extra.folderId);
  return new Request("http://localhost/api/v1/media", {
    method: "POST",
    body: form,
  });
}

describe("media POST", () => {
  test("rejects unauthenticated uploads", async () => {
    mockContext.mockResolvedValue(null);
    const res = await POST(uploadRequest([new File(["hi"], "hello.txt", { type: "text/plain" })]));
    expect(res.status).toBe(401);
    expect(mockStorage.put).not.toHaveBeenCalled();
  });

  test("rejects uploads without media.manage permission", async () => {
    mockCan.mockReturnValue(false);
    const res = await POST(uploadRequest([new File(["hi"], "hello.txt", { type: "text/plain" })]));
    expect(res.status).toBe(403);
    expect(mockStorage.put).not.toHaveBeenCalled();
  });

  test("rejects non-multipart requests", async () => {
    const res = await POST(
      new Request("http://localhost/api/v1/media", { method: "POST" })
    );
    expect(res.status).toBe(415);
  });

  test("rejects requests with no files", async () => {
    const form = new FormData();
    const res = await POST(
      new Request("http://localhost/api/v1/media", {
        method: "POST",
        body: form,
      })
    );
    expect(res.status).toBe(400);
  });

  test("stores via the storage provider and creates a DB record", async () => {
    const file = new File(["hi"], "hello.txt", { type: "text/plain" });
    const res = await POST(uploadRequest([file]));
    expect(res.status).toBe(201);
    expect(mockStorage.put).toHaveBeenCalledWith(
      expect.stringContaining("ws-1"),
      expect.any(Uint8Array),
      "text/plain"
    );
    expect(mockPrisma.mediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "ws-1",
          uploadedById: "user-1",
          fileName: "hello.txt",
          sizeBytes: 4,
          type: "DOCUMENT",
        }),
      })
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "media.uploaded" })
    );
  });

  test("enforces storage quota before writing", async () => {
    mockQuota.mockRejectedValue(new Error("quota exceeded"));
    const res = await POST(uploadRequest([new File(["hi"], "a.txt", { type: "text/plain" })]));
    expect(res.status).toBe(500);
    expect(mockStorage.put).not.toHaveBeenCalled();
  });
});

describe("media GET", () => {
  test("lists assets for the workspace", async () => {
    mockPrisma.mediaAsset.findMany.mockResolvedValue([{ id: "a1" }]);
    mockPrisma.mediaAsset.count.mockResolvedValue(1);
    const res = await GET(new Request("http://localhost/api/v1/media?limit=12"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.assets).toHaveLength(1);
    expect(json.data.pagination).toEqual({ page: 1, limit: 12, total: 1, totalPages: 1 });
  });

  test("rejects unauthenticated listing", async () => {
    mockContext.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/v1/media"));
    expect(res.status).toBe(401);
  });
});
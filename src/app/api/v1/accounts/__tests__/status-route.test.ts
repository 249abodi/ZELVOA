import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET as statusGet } from "@/app/api/v1/accounts/status/route";
import { ALL_PLATFORMS } from "@/lib/integrations/types";

const { mockGetCurrentContext } = vi.hoisted(() => ({
  mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: () => mockGetCurrentContext() }));

const CONTEXT = {
  user: { id: "user-1", email: "a@b.co", name: "A User", avatarUrl: null },
  organization: { id: "org-9", name: "Org", slug: "org", timezone: "UTC" },
  workspace: { id: "ws-9", name: "Workspace", slug: "ws", timezone: "UTC" },
  role: "OWNER",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentContext.mockResolvedValue(CONTEXT);
});

describe("accounts status — provider capabilities contract", () => {
  test("returns capabilities as an array of strings for every provider (regression: production crash)", async () => {
    const res = await statusGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { providers: Array<{ platform: string; capabilities: unknown }> } };
    const { providers } = body.data;
    expect(providers.length).toBeGreaterThan(0);

    for (const provider of providers) {
      const capabilities = provider.capabilities as unknown[];
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.every((c) => typeof c === "string")).toBe(true);
      // exact UI expression from connect-modal.tsx must not throw
      expect((capabilities as string[]).join(", ")).toBeTypeOf("string");
    }
  });

  test("includes every known platform exactly once", async () => {
    const res = await statusGet();
    const body = (await res.json()) as { data: { providers: Array<{ platform: string }> } };
    const platforms = body.data.providers.map((p) => p.platform);
    expect(platforms).toEqual(expect.arrayContaining(ALL_PLATFORMS));
    expect(new Set(platforms).size).toBe(platforms.length);
  });

  test("requires an authenticated user", async () => {
    mockGetCurrentContext.mockResolvedValue(null);
    const res = await statusGet();
    expect(res.status).toBe(401);
  });
});
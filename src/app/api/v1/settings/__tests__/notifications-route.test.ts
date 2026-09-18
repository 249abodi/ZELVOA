import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PATCH } from "@/app/api/v1/settings/notifications/route";

const { mockPrisma, mockGetCurrentContext } = vi.hoisted(() => ({
  mockPrisma: {
    userSettings: {
      upsert: vi.fn(),
    },
  },
  mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({
  getCurrentContext: () => mockGetCurrentContext(),
}));

const CONTEXT = {
  user: { id: "user-1", email: "a@b.co", name: "A User", avatarUrl: null },
  organization: { id: "org-1", name: "Org", slug: "org", timezone: "UTC" },
  workspace: { id: "ws-1", name: "WS", slug: "ws", timezone: "UTC" },
  role: "OWNER",
};

function makeRequest(overrides: Record<string, unknown> = {}): Request {
  return new Request("http://localhost/api/v1/settings/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emailNotifications: true,
      inAppNotifications: false,
      marketingEmails: true,
      ...overrides,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentContext.mockResolvedValue(CONTEXT);
  mockPrisma.userSettings.upsert.mockResolvedValue({
    emailNotifications: true,
    inAppNotifications: false,
    marketingEmails: true,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("settings notifications PATCH", () => {
  test("persists the preferences via upsert and returns them", async () => {
    const res = await PATCH(makeRequest());
    expect(res.status).toBe(200);

    expect(mockPrisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({
          userId: "user-1",
          emailNotifications: true,
          inAppNotifications: false,
          marketingEmails: true,
        }),
        update: expect.objectContaining({
          emailNotifications: true,
          inAppNotifications: false,
          marketingEmails: true,
        }),
      })
    );

    const body = await res.json();
    expect(body.data.settings).toEqual({
      emailNotifications: true,
      inAppNotifications: false,
      marketingEmails: true,
    });
  });

  test("rejects requests without an authenticated user", async () => {
    mockGetCurrentContext.mockResolvedValue(null);
    const res = await PATCH(makeRequest());
    expect(res.status).toBe(401);
    expect(mockPrisma.userSettings.upsert).not.toHaveBeenCalled();
  });

  test("rejects a malformed body", async () => {
    const res = await PATCH(makeRequest({ emailNotifications: "yes" }));
    expect(res.status).toBe(422);
    expect(mockPrisma.userSettings.upsert).not.toHaveBeenCalled();
  });

  test("never leaks user identity or tokens in responses", async () => {
    const res = await PATCH(makeRequest());
    const raw = await res.text();
    expect(raw).not.toContain("user-1");
    expect(raw).not.toContain("zelvoa_session");
  });
});
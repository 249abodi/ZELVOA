import { describe, it, expect } from "vitest";
import { serializeAccount } from "@/lib/integrations/serializer";
import type { SocialAccount, SocialAccountToken } from "@prisma/client";

const TOKEN_MARKER = "ENCRYPTED-ACCESS-TOKEN-VALUE";
const REFRESH_MARKER = "ENCRYPTED-REFRESH-TOKEN-VALUE";

type AccountOverrides = Partial<Omit<SocialAccount, "token">> & {
  token?: SocialAccountToken | null;
};

function makeToken(overrides: Partial<SocialAccountToken> = {}): SocialAccountToken {
  return {
    id: "tok_1",
    socialAccountId: "acc_1",
    encryptedAccessToken: TOKEN_MARKER,
    encryptedRefreshToken: REFRESH_MARKER,
    tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    scopes: ["pages_manage_posts"],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdById: "user_1",
    ...overrides,
  };
}

function makeAccount(overrides: AccountOverrides = {}): SocialAccount {
  return {
    id: "acc_1",
    workspaceId: "ws_1",
    platform: "FACEBOOK",
    platformAccountId: "page_1",
    name: "ZELVOA",
    username: "zelvoa",
    avatarUrl: "https://img/avatar.png",
    status: "CONNECTED",
    lastSyncAt: new Date("2026-01-02T00:00:00.000Z"),
    scopes: ["pages_manage_posts"],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
    token: overrides.token !== undefined ? overrides.token : makeToken(),
  } as SocialAccount;
}

describe("serializeAccount", () => {
  it("never includes token material in the API shape", () => {
    const summary = serializeAccount(makeAccount(), makeToken());
    const json = JSON.stringify(summary);

    expect(summary.token).toEqual({
      hasAccessToken: true,
      hasRefreshToken: true,
      expiresAt: expect.any(String),
      expired: false,
      expiresSoon: false,
    });

    expect(json).not.toContain(TOKEN_MARKER);
    expect(json).not.toContain(REFRESH_MARKER);
    expect(json).not.toContain("encryptedAccessToken");
    expect(json).not.toContain("encryptedRefreshToken");
  });

  it("exposes only boolean presence flags when no token is stored", () => {
    const summary = serializeAccount(makeAccount({ token: null }), null);
    expect(summary.token).toEqual({
      hasAccessToken: false,
      hasRefreshToken: false,
      expiresAt: null,
      expired: false,
      expiresSoon: false,
    });
  });

  it("marks expired and expiring tokens", () => {
    const past = serializeAccount(makeAccount(), makeToken({ tokenExpiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60) }));
    expect(past.token?.expired).toBe(true);
    expect(past.token?.expiresSoon).toBe(false);

    const soon = serializeAccount(
      makeAccount(),
      makeToken({ tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2) })
    );
    expect(soon.token?.expired).toBe(false);
    expect(soon.token?.expiresSoon).toBe(true);
  });

  it("does not leak the workspace id in the summary", () => {
    const summary = serializeAccount(makeAccount());
    expect(JSON.stringify(summary)).not.toContain("ws_1");
  });
});
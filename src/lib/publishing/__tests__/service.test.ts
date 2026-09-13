import { describe, it, expect, beforeEach, vi } from "vitest";
import { PublishingError } from "@/lib/publishing/errors";

const state = vi.hoisted(() => ({
  registryConfigured: true,
  registryDevMode: false,
  provider: {
    publish: vi.fn(),
    refresh: vi.fn(),
  },
  prisma: {
    scheduledPost: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    socialAccountToken: { update: vi.fn() },
    socialAccount: { updateMany: vi.fn() },
    post: { update: vi.fn() },
    userSettings: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
  },
  writeAudit: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: state.prisma }));
vi.mock("@/lib/crypto", () => ({
  decryptSecret: vi.fn(() => "plain-token"),
  encryptSecret: vi.fn((value: string) => `enc:${value}`),
  signMediaUrl: vi.fn(() => "sig-123"),
}));
vi.mock("@/lib/integrations/factory", () => ({
  getProvider: () => state.provider,
}));
vi.mock("@/lib/integrations/registry", () => ({
  getRegistryEntry: () => ({
    configured: state.registryConfigured,
    devMode: state.registryDevMode,
    reason: "test",
  }),
}));
vi.mock("@/lib/audit", () => ({
  writeAudit: state.writeAudit,
}));
vi.mock("@/lib/notifications/service", () => ({
  createNotification: state.createNotification,
}));

import { publishingService } from "@/lib/publishing/service";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "sp_1",
    workspaceId: "ws_1",
    postId: "post_1",
    socialAccountId: "acc_1",
    platform: "INSTAGRAM",
    scheduledFor: new Date("2026-01-01T00:00:00.000Z"),
    status: "PENDING",
    attemptCount: 0,
    maxAttempts: 3,
    nextAttemptAt: null,
    idempotencyKey: "k1",
    providerJobId: null,
    errorCode: null,
    errorMessage: null,
    errorStage: null,
    lastAttemptAt: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    post: {
      id: "post_1",
      createdById: "user_1",
      content: "Hello",
      postType: "STANDARD",
      variants: [{ platform: "INSTAGRAM", content: "Hello Instagram", firstComment: null }],
      media: [
        {
          mediaAsset: {
            id: "m1",
            type: "IMAGE",
            mimeType: "image/jpeg",
            storageKey: "m1.jpg",
            fileName: "post.jpg",
          },
        },
      ],
    },
    socialAccount: {
      id: "acc_1",
      platformAccountId: "ig_user_1",
      scopes: [],
      token: {
        encryptedAccessToken: "enc",
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
      },
    },
    ...overrides,
  };
}

function resetAll() {
  Object.values(state.prisma.scheduledPost).forEach((fn) => fn.mockReset());
  Object.values(state.prisma.socialAccountToken).forEach((fn) => fn.mockReset());
  Object.values(state.prisma.socialAccount).forEach((fn) => fn.mockReset());
  Object.values(state.prisma.post).forEach((fn) => fn.mockReset());
  state.prisma.userSettings.findUnique.mockReset();
  state.prisma.notification.create.mockReset();
  state.prisma.scheduledPost.update.mockResolvedValue({});
  state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });
  state.prisma.socialAccount.updateMany.mockResolvedValue({ count: 1 });
  state.prisma.socialAccountToken.update.mockResolvedValue({});
  state.prisma.post.update.mockResolvedValue({});
  state.prisma.scheduledPost.groupBy.mockResolvedValue([]);
  state.prisma.userSettings.findUnique.mockResolvedValue(null);
  state.prisma.notification.create.mockResolvedValue({});
  state.writeAudit.mockReset();
  state.createNotification.mockReset();
  state.provider.publish.mockReset();
  state.provider.refresh.mockReset();
  state.registryConfigured = true;
  state.registryDevMode = false;
}

describe("PublishingService.publishScheduledPost", () => {
  beforeEach(() => {
    resetAll();
  });

  it("publishes a due job and stores the provider id", async () => {
    state.prisma.scheduledPost.findUnique.mockResolvedValue(makeJob());
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });
    state.prisma.scheduledPost.groupBy.mockResolvedValue([
      { status: "PUBLISHED", _count: { _all: 1 } },
    ]);
    state.prisma.scheduledPost.update.mockResolvedValue({});
    state.provider.publish.mockResolvedValue({
      providerPostId: "ig_media_123",
      publishedAt: "2026-01-01T00:00:05.000Z",
      url: "https://www.instagram.com/p/ig_media_123",
    });

    const outcome = await publishingService.publishScheduledPost("sp_1");

    expect(outcome.status).toBe("PUBLISHED");
    expect(outcome.providerJobId).toBe("ig_media_123");
    expect(state.provider.publish).toHaveBeenCalledTimes(1);
    const input = state.provider.publish.mock.calls[0][0];
    expect(input.platformAccountId).toBe("ig_user_1");
    expect(input.content).toBe("Hello Instagram");
    expect(input.media).toHaveLength(1);
    expect(String(input.media[0].url)).toContain("api/v1/media/m1/file");
    expect(String(input.media[0].url)).toContain("sig=sig-123");
  });

  it("does not double-process an already claimed job", async () => {
    state.prisma.scheduledPost.findUnique.mockResolvedValue(makeJob());
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 0 });

    const outcome = await publishingService.publishScheduledPost("sp_1");

    expect(outcome.status).toBe("PENDING");
    expect(state.provider.publish).not.toHaveBeenCalled();
  });

  it("schedules a retry on a retryable provider failure", async () => {
    state.prisma.scheduledPost.findUnique.mockResolvedValue(makeJob());
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });
    state.prisma.scheduledPost.groupBy.mockResolvedValue([]);
    state.provider.publish.mockRejectedValue(
      new PublishingError({
        code: "PROVIDER_RATE_LIMITED",
        stage: "PROVIDER_PUBLISH",
        message: "Rate limited",
        retryable: true,
      })
    );

    const outcome = await publishingService.publishScheduledPost("sp_1");

    expect(outcome.status).toBe("RETRYING");
    expect(outcome.errorCode).toBe("PROVIDER_RATE_LIMITED");
    const update = state.prisma.scheduledPost.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(update.data.status).toBe("RETRYING");
    expect(update.data.attemptCount).toBe(1);
    expect((update.data.nextAttemptAt as Date).getTime()).toBeGreaterThan(Date.now());
    expect(state.createNotification).toHaveBeenCalledTimes(0);
  });

  it("fails permanently once max attempts are exhausted", async () => {
    state.prisma.scheduledPost.findUnique.mockResolvedValue(
      makeJob({ attemptCount: 3, maxAttempts: 3 })
    );
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });
    state.prisma.scheduledPost.groupBy.mockResolvedValue([]);
    state.provider.publish.mockRejectedValue(
      new PublishingError({
        code: "PROVIDER_ERROR",
        stage: "PROVIDER_PUBLISH",
        message: "boom",
        retryable: true,
      })
    );

    const outcome = await publishingService.publishScheduledPost("sp_1");

    expect(outcome.status).toBe("FAILED_PERMANENTLY");
    const update = state.prisma.scheduledPost.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(update.data.status).toBe("FAILED_PERMANENTLY");
    expect(update.data.errorCode).toBe("PROVIDER_ERROR");
    expect(state.createNotification).toHaveBeenCalledTimes(1);
  });

  it("fails permanently when the provider is not configured", async () => {
    state.registryConfigured = false;
    state.prisma.scheduledPost.findUnique.mockResolvedValue(makeJob());
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });

    const outcome = await publishingService.publishScheduledPost("sp_1");

    expect(outcome.status).toBe("FAILED_PERMANENTLY");
    expect(outcome.errorCode).toBe("NOT_CONFIGURED");
    const update = state.prisma.scheduledPost.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(update.data.errorCode).toBe("NOT_CONFIGURED");
    expect(state.provider.publish).not.toHaveBeenCalled();
  });

  it("fails permanently for platforms whose publishing is not implemented", async () => {
    state.prisma.scheduledPost.findUnique.mockResolvedValue(
      makeJob({ platform: "TIKTOK", post: { ...makeJob().post, variants: [{ platform: "TIKTOK", content: "hi", firstComment: null }] } })
    );
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });

    const outcome = await publishingService.publishScheduledPost("sp_1");

    expect(outcome.errorCode).toBe("NOT_IMPLEMENTED");
    expect(outcome.status).toBe("FAILED_PERMANENTLY");
  });

  it("stores safe messages without leaking provider internals", async () => {
    state.prisma.scheduledPost.findUnique.mockResolvedValue(makeJob({ platform: "TIKTOK" }));
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });

    await publishingService.publishScheduledPost("sp_1");

    const update = state.prisma.scheduledPost.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(String(update.data.errorMessage)).toContain("not available");
    expect(String(update.data.errorMessage)).not.toContain("TIKTOK");
  });

  it("fails permanently when the account status is EXPIRED", async () => {
    state.prisma.scheduledPost.findUnique.mockResolvedValue(
      makeJob({ socialAccount: { ...makeJob().socialAccount, status: "EXPIRED" } })
    );
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });

    const outcome = await publishingService.publishScheduledPost("sp_1");

    expect(outcome.status).toBe("FAILED_PERMANENTLY");
    expect(outcome.errorCode).toBe("ACCOUNT_INVALID");
    expect(state.provider.publish).not.toHaveBeenCalled();
  });

  it("fails permanently when the account status is DISCONNECTED", async () => {
    state.prisma.scheduledPost.findUnique.mockResolvedValue(
      makeJob({ socialAccount: { ...makeJob().socialAccount, status: "DISCONNECTED" } })
    );
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });

    const outcome = await publishingService.publishScheduledPost("sp_1");

    expect(outcome.status).toBe("FAILED_PERMANENTLY");
    expect(outcome.errorCode).toBe("ACCOUNT_INVALID");
    expect(state.provider.publish).not.toHaveBeenCalled();
  });

  it("stores refreshed tokens encrypted, never in plaintext", async () => {
    state.prisma.scheduledPost.findUnique.mockResolvedValue(
      makeJob({
        socialAccount: {
          ...makeJob().socialAccount,
          token: {
            encryptedAccessToken: "enc",
            encryptedRefreshToken: "enc-refresh",
            tokenExpiresAt: new Date(Date.now() + 60 * 1000),
          },
        },
      })
    );
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });
    state.provider.refresh.mockResolvedValue({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresInSeconds: 3600,
    });
    state.provider.publish.mockResolvedValue({
      providerPostId: "ig_media_refreshed",
      publishedAt: new Date().toISOString(),
    });

    const outcome = await publishingService.publishScheduledPost("sp_1");

    expect(outcome.status).toBe("PUBLISHED");
    const update = state.prisma.socialAccountToken.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(update.data.encryptedAccessToken).toBe("enc:new-access-token");
    expect(update.data.encryptedRefreshToken).toBe("enc:new-refresh-token");
    expect(update.data.encryptedAccessToken).not.toBe("new-access-token");
    expect(update.data.encryptedRefreshToken).not.toBe("new-refresh-token");
  });
});

describe("PublishingService.pumpDue", () => {
  beforeEach(() => {
    resetAll();
  });

  it("processes only jobs that are due", async () => {
    const due1 = makeJob({ id: "sp_a" });
    const due2 = makeJob({ id: "sp_b", status: "RETRYING" });
    state.prisma.scheduledPost.findMany.mockResolvedValue([{ id: "sp_a" }, { id: "sp_b" }]);
    state.prisma.scheduledPost.findUnique
      .mockResolvedValueOnce(due1)
      .mockResolvedValueOnce(due2);
    state.prisma.scheduledPost.updateMany.mockResolvedValue({ count: 1 });
    state.prisma.scheduledPost.groupBy.mockResolvedValue([
      { status: "PUBLISHED", _count: { _all: 1 } },
    ]);
    state.provider.publish.mockResolvedValue({ providerPostId: "ok", publishedAt: new Date().toISOString() });

    const result = await publishingService.pumpDue(10);

    expect(result.claimed).toEqual(["sp_a", "sp_b"]);
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes.every((o) => o.status === "PUBLISHED")).toBe(true);
  });
});
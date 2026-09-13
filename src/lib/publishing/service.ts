import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getProvider } from "@/lib/integrations/factory";
import { getPlatformLimits, isPublishingImplemented } from "@/lib/integrations/platforms";
import { getRegistryEntry } from "@/lib/integrations/registry";
import { redactError } from "@/lib/integrations/redact";
import type { PublishMediaInput } from "@/lib/integrations/types";
import { isDevMarkerScope } from "@/lib/integrations/dev-provider";
import { PublishingError, safeMessage, isPermanent } from "@/lib/publishing/errors";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/service";
import { signMediaUrl } from "@/lib/crypto";
import type { Post, ScheduledPost, SocialAccount } from "@prisma/client";

export interface PublishOutcome {
  scheduledPostId: string;
  status: string;
  providerJobId?: string | null;
  errorCode?: string | null;
}

type JobWithRelations = ScheduledPost & {
  post: Post & {
    variants: { platform: string; content: string; firstComment: string | null }[];
    media: { mediaAsset: { id: string; type: string; mimeType: string; storageKey: string; fileName: string } }[];
  };
  socialAccount: (SocialAccount & { token: { encryptedAccessToken: string; encryptedRefreshToken: string | null; tokenExpiresAt: Date | null } | null }) | null;
};

function backoffMs(attempt: number): number {
  const minutes = [5, 15, 45, 120, 360, 720, 1440];
  const index = Math.min(Math.max(attempt - 1, 0), minutes.length - 1);
  return minutes[index] * 60 * 1000;
}

function boundUrl(
  assetId: string,
  plusSeconds = 6 * 60 * 60
): string | null {
  if (!assetId) return null;
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/api/v1/media/${assetId}/file?sig=${signMediaUrl(assetId, Date.now() + plusSeconds * 1000)}`;
}

function buildMediaInputs(post: JobWithRelations["post"]): PublishMediaInput[] | null {
  const items = post.media ?? [];
  if (items.length === 0) return [];
  const inputs: PublishMediaInput[] = [];
  for (const item of items) {
    const url = boundUrl(item.mediaAsset.id);
    if (!url) return null;
    inputs.push({
      url,
      mimeType: item.mediaAsset.mimeType,
      type: item.mediaAsset.type === "IMAGE" ? "IMAGE" : item.mediaAsset.type === "VIDEO" ? "VIDEO" : "IMAGE",
    });
  }
  return inputs;
}

async function syncPostStatus(postId: string) {
  const counts = await prisma.scheduledPost.groupBy({
    by: ["status"],
    where: { postId },
    _count: { _all: true },
  });
  const bucket: Record<string, number> = {};
  for (const row of counts) bucket[row.status] = row._count._all;

  let status: string;
  if ((bucket.PENDING ?? 0) > 0 || (bucket.PROCESSING ?? 0) > 0 || (bucket.RETRYING ?? 0) > 0 || (bucket.QUEUED ?? 0) > 0) {
    status = "PROCESSING";
  } else if ((bucket.PUBLISHED ?? 0) > 0 && (bucket.FAILED ?? 0) === 0 && (bucket.FAILED_PERMANENTLY ?? 0) === 0) {
    status = "PUBLISHED";
  } else if ((bucket.PUBLISHED ?? 0) > 0) {
    status = "FAILED";
  } else if ((bucket.FAILED_PERMANENTLY ?? 0) > 0) {
    status = "FAILED_PERMANENTLY";
  } else {
    status = "FAILED";
  }

  const data: { status?: string; publishedAt?: Date | null } = {};
  if (status === "PUBLISHED") {
    data.status = "PUBLISHED";
    data.publishedAt = new Date();
  } else {
    data.status = status;
  }
  await prisma.post.update({ where: { id: postId }, data: data as never });
}

async function finalizeFailure(
  job: JobWithRelations,
  code: Parameters<typeof isPermanent>[0],
  stage: ScheduledPost["errorStage"],
  retryable: boolean,
  _detail: unknown
): Promise<"RETRYING" | "FAILED_PERMANENTLY"> {
  const attemptCount = job.attemptCount;
  const permanent = !retryable || isPermanent(code);
  const lastAttemptAt = new Date();

  if (permanent || attemptCount >= job.maxAttempts) {
    await prisma.scheduledPost.update({
      where: { id: job.id },
      data: {
        status: "FAILED_PERMANENTLY",
        errorCode: code,
        errorMessage: safeMessage(code),
        errorStage: stage ?? null,
        lastAttemptAt,
      },
    });
    await prisma.socialAccount.updateMany({
      where: { id: job.socialAccountId ?? "" },
      data: { status: code === "AUTH_EXPIRED" || code === "NOT_AUTHENTICATED" ? "EXPIRED" : "ERROR" },
    }).catch(() => undefined);
    await syncPostStatus(job.postId);
    await writeAudit({
      workspaceId: job.workspaceId,
      postId: job.postId,
      socialAccountId: job.socialAccountId,
      action: "post.publish_failed",
      entityType: "ScheduledPost",
      entityId: job.id,
      metadata: { errorCode: code, stage: stage ?? null } as never,
    });
    await createNotification({
      workspaceId: job.workspaceId,
      userId: job.post.createdById,
      type: "POST_FAILED",
      title: "Post failed permanently",
      body: safeMessage(code),
      data: { postId: job.postId, scheduledPostId: job.id, platform: job.platform, errorCode: code } as never,
    });
    if (code === "AUTH_EXPIRED" || code === "NOT_AUTHENTICATED") {
      await createNotification({
        workspaceId: job.workspaceId,
        userId: job.post.createdById,
        type: "TOKEN_EXPIRED",
        title: "Connected account token has expired",
        body: safeMessage(code),
        data: { postId: job.postId, scheduledPostId: job.id, platform: job.platform, errorCode: code } as never,
      }).catch(() => undefined);
    }
    return "FAILED_PERMANENTLY";
  }

  await prisma.scheduledPost.update({
    where: { id: job.id },
    data: {
      status: "RETRYING",
      errorCode: code,
      errorMessage: safeMessage(code),
      errorStage: stage ?? null,
      attemptCount,
      lastAttemptAt,
      nextAttemptAt: new Date(Date.now() + backoffMs(attemptCount)),
    },
  });
  await syncPostStatus(job.postId);
  await writeAudit({
    workspaceId: job.workspaceId,
    postId: job.postId,
    socialAccountId: job.socialAccountId,
    action: "post.publish_retry_scheduled",
    entityType: "ScheduledPost",
    entityId: job.id,
    metadata: { errorCode: code, attempt: attemptCount, stage: stage ?? null } as never,
  });
  return "RETRYING";
}

export class PublishingService {
  async publishScheduledPost(id: string): Promise<PublishOutcome> {
    const job = (await prisma.scheduledPost.findUnique({
      where: { id },
      include: {
        post: {
          include: {
            variants: true,
            media: { include: { mediaAsset: true } },
          },
        },
        socialAccount: { include: { token: true } },
      },
    })) as JobWithRelations | null;

    if (!job) return { scheduledPostId: id, status: "NOT_FOUND" };

    const claimed = await prisma.scheduledPost.updateMany({
      where: {
        id,
        status: { in: ["PENDING", "RETRYING"] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      data: {
        status: "PROCESSING",
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      return { scheduledPostId: id, status: job.status };
    }

    const refreshed: JobWithRelations = { ...job, attemptCount: job.attemptCount + 1 };

    const entry = getRegistryEntry(refreshed.platform);
    if (!entry.configured && !entry.devMode) {
      const status = await finalizeFailure(refreshed, "NOT_CONFIGURED", "QUEUE", false, null);
      return { scheduledPostId: id, status, errorCode: "NOT_CONFIGURED" };
    }

    const provider = getProvider(refreshed.platform);
    if (!isPublishingImplemented(refreshed.platform) && !provider.isDevProvider) {
      const status = await finalizeFailure(refreshed, "NOT_IMPLEMENTED", "PROVIDER_PUBLISH", false, null);
      return { scheduledPostId: id, status, errorCode: "NOT_IMPLEMENTED" };
    }

    if (!refreshed.socialAccount?.token) {
      const status = await finalizeFailure(refreshed, "NOT_AUTHENTICATED", "PROVIDER_CONNECT", true, null);
      return { scheduledPostId: id, status, errorCode: "NOT_AUTHENTICATED" };
    }

    if (
      refreshed.socialAccount.status === "DISCONNECTED" ||
      refreshed.socialAccount.status === "REVOKED" ||
      refreshed.socialAccount.status === "EXPIRED"
    ) {
      const status = await finalizeFailure(refreshed, "ACCOUNT_INVALID", "PROVIDER_CONNECT", false, null);
      return { scheduledPostId: id, status, errorCode: "ACCOUNT_INVALID" };
    }

    let accessToken: string;
    try {
      accessToken = decryptSecret(refreshed.socialAccount.token.encryptedAccessToken);
    } catch {
      const status = await finalizeFailure(refreshed, "NOT_AUTHENTICATED", "PROVIDER_AUTH", true, null);
      return { scheduledPostId: id, status, errorCode: "NOT_AUTHENTICATED" };
    }

    const expiresAt = refreshed.socialAccount.token.tokenExpiresAt;
    if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000 && refreshed.socialAccount.token.encryptedRefreshToken) {
      try {
        let refreshToken: string;
        try {
          refreshToken = decryptSecret(refreshed.socialAccount.token.encryptedRefreshToken);
        } catch {
          refreshToken = "";
        }
        if (refreshToken) {
          const result = await provider.refresh(refreshToken);
          accessToken = result.accessToken;
          await prisma.socialAccountToken.update({
            where: { socialAccountId: refreshed.socialAccount!.id },
            data: {
              encryptedAccessToken: encryptSecret(result.accessToken),
              ...(result.refreshToken ? { encryptedRefreshToken: encryptSecret(result.refreshToken) } : {}),
              ...(result.expiresInSeconds ? { tokenExpiresAt: new Date(Date.now() + result.expiresInSeconds * 1000) } : {}),
            },
          });
          await prisma.socialAccount.updateMany({
            where: { id: refreshed.socialAccount!.id },
            data: { status: "CONNECTED", lastSyncAt: new Date() },
          });
        }
      } catch (error) {
        await prisma.socialAccount.updateMany({
          where: { id: refreshed.socialAccount!.id },
          data: { status: "EXPIRED" },
        });
        const status = await finalizeFailure(refreshed, "AUTH_EXPIRED", "PROVIDER_AUTH", true, error);
        return { scheduledPostId: id, status, errorCode: "AUTH_EXPIRED" };
      }
    }

    const variant = refreshed.post.variants?.find((v) => v.platform === refreshed.platform);
    const content = variant?.content ?? refreshed.post.content;
    const isDev = provider.isDevProvider || isDevMarkerScope(refreshed.socialAccount.scopes ?? []);
    const limits = getPlatformLimits(refreshed.platform);

    if (!isDev && content.length > limits.captionLimit) {
      const status = await finalizeFailure(refreshed, "CONTENT_INVALID", "PROVIDER_PUBLISH", false, null);
      return { scheduledPostId: id, status, errorCode: "CONTENT_INVALID" };
    }

    const media = buildMediaInputs(refreshed.post);
    if (!media) {
      const status = await finalizeFailure(refreshed, "MEDIA_UNAVAILABLE", "PROVIDER_PUBLISH", true, null);
      return { scheduledPostId: id, status, errorCode: "MEDIA_UNAVAILABLE" };
    }
    if (!isDev && limits.mediaRequired && media.length === 0) {
      const status = await finalizeFailure(refreshed, "MEDIA_INVALID", "PROVIDER_PUBLISH", false, null);
      return { scheduledPostId: id, status, errorCode: "MEDIA_INVALID" };
    }

    try {
      const result = await provider.publish!({
        accessToken,
        platformAccountId: refreshed.socialAccount.platformAccountId,
        content,
        firstComment: variant?.firstComment ?? null,
        postType: refreshed.post.postType,
        media,
      });

      await prisma.scheduledPost.update({
        where: { id: id },
        data: {
          status: "PUBLISHED",
          providerJobId: result.providerPostId,
          publishedAt: new Date(result.publishedAt),
          errorCode: null,
          errorMessage: null,
          errorStage: null,
          lastAttemptAt: new Date(),
        },
      });

      await syncPostStatus(refreshed.postId);
      await writeAudit({
        workspaceId: refreshed.workspaceId,
        postId: refreshed.postId,
        socialAccountId: refreshed.socialAccount.id,
        actorId: refreshed.post.createdById,
        action: "post.published",
        entityType: "ScheduledPost",
        entityId: id,
        metadata: {
          platform: refreshed.platform,
          providerPostId: result.providerPostId,
          isDev,
        } as never,
      });
      await createNotification({
        workspaceId: refreshed.workspaceId,
        userId: refreshed.post.createdById,
        type: "POST_PUBLISHED",
        title: `Post published on ${refreshed.platform}`,
        body: result.url ?? undefined,
        data: {
          postId: refreshed.postId,
          scheduledPostId: id,
          platform: refreshed.platform,
          providerPostId: result.providerPostId,
        } as never,
      });

      return {
        scheduledPostId: id,
        status: "PUBLISHED",
        providerJobId: result.providerPostId,
      };
    } catch (error) {
      console.error(
        "[publish]",
        refreshed.platform,
        id,
        error instanceof PublishingError ? redactError(error.message) : redactError(error)
      );
      const code = error instanceof PublishingError ? error.code : "PROVIDER_ERROR";
      const stage = error instanceof PublishingError ? error.stage : "PROVIDER_PUBLISH";
      const retryable = error instanceof PublishingError ? error.retryable : true;
      const status = await finalizeFailure(refreshed, code, stage, retryable, error);
      return { scheduledPostId: id, status, errorCode: code };
    }
  }

  async pumpDue(limit = 10): Promise<{ claimed: string[]; outcomes: PublishOutcome[] }> {
    const now = new Date();
    const due = await prisma.scheduledPost.findMany({
      where: {
        status: { in: ["PENDING", "RETRYING"] },
        scheduledFor: { lte: now },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: { id: true },
    });

    const outcomes: PublishOutcome[] = [];
    for (const job of due) {
      outcomes.push(await this.publishScheduledPost(job.id));
    }
    return { claimed: due.map((j) => j.id), outcomes };
  }
}

export const publishingService = new PublishingService();
import { prisma } from "@/lib/db";
import { hasDevScope } from "@/lib/inbox/source";
import { generateDevSnapshots } from "@/lib/analytics/dev-data";
import type { SnapshotData } from "@/lib/analytics/types";

export interface SyncResult {
  created: number;
  skipped: number;
  unsupported: { accountId: string; platform: string }[];
  devMode: boolean;
}

function isDevMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_PROVIDERS === "true";
}

async function upsertSnapshot(
  workspaceId: string,
  data: SnapshotData
): Promise<boolean> {
  const existing = await prisma.analyticsSnapshot.findFirst({
    where: {
      workspaceId,
      socialAccountId: data.socialAccountId ?? null,
      postId: data.postId ?? null,
      platform: data.platform ?? null,
      periodStart: data.periodStart,
    },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.analyticsSnapshot.create({
    data: {
      workspaceId,
      postId: data.postId ?? undefined,
      socialAccountId: data.socialAccountId ?? undefined,
      platform: data.platform ?? undefined,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      followers: data.followers,
      reach: data.reach,
      impressions: data.impressions,
      engagement: data.engagement,
      likes: data.likes,
      comments: data.comments,
      shares: data.shares,
      saves: data.saves,
      clicks: data.clicks,
    },
  });
  return true;
}

export async function syncAnalytics(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<SyncResult> {
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId, status: "CONNECTED" },
    select: {
      id: true,
      platform: true,
      scopes: true,
    },
  });

  const devMode = isDevMode();
  let created = 0;
  let skipped = 0;
  const unsupported: SyncResult["unsupported"] = [];

  for (const account of accounts) {
    const scopes = account.scopes ?? [];
    const isDev = hasDevScope(scopes);

    if (!isDev) {
      unsupported.push({ accountId: account.id, platform: account.platform });
      continue;
    }
    if (!devMode) {
      unsupported.push({ accountId: account.id, platform: account.platform });
      continue;
    }

    const snapshots = generateDevSnapshots({
      workspaceId,
      accountId: account.id,
      platform: account.platform,
      from,
      to,
      baseFollowers: 200 + Array.from(account.id).reduce((s, c) => s + c.charCodeAt(0), 0) % 800,
    });

    for (const snap of snapshots) {
      const inserted = await upsertSnapshot(workspaceId, snap);
      if (inserted) created++;
      else skipped++;
    }
  }

  return { created, skipped, unsupported, devMode };
}
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { PlatformType } from "@prisma/client";
import type { AnalyticsTimeSeries, TopPostData } from "@/lib/analytics/types";

interface QueryOpts {
  workspaceId: string;
  from: Date;
  to: Date;
  platform?: PlatformType;
}

function platformFilter(platform?: PlatformType): Prisma.AnalyticsSnapshotWhereInput | undefined {
  return platform ? { platform } : undefined;
}

export async function getAnalyticsSummary(opts: QueryOpts) {
  const where: Prisma.AnalyticsSnapshotWhereInput = {
    workspaceId: opts.workspaceId,
    periodStart: { gte: opts.from },
    periodEnd: { lte: opts.to },
    ...platformFilter(opts.platform),
  };

  const row = await prisma.analyticsSnapshot.aggregate({
    where,
    _sum: {
      reach: true,
      impressions: true,
      engagement: true,
      likes: true,
      comments: true,
      shares: true,
      saves: true,
      clicks: true,
    },
    _count: true,
  });

  const latestFollowers = await prisma.analyticsSnapshot.findFirst({
    where: { workspaceId: opts.workspaceId, ...platformFilter(opts.platform) },
    orderBy: { periodStart: "desc" },
    select: { followers: true, periodStart: true },
  });

  const prevFrom = new Date(opts.from);
  prevFrom.setDate(prevFrom.getDate() - Math.ceil((opts.to.getTime() - opts.from.getTime()) / 86_400_000));
  const prevTo = new Date(opts.from);
  prevTo.setDate(prevTo.getDate() - 1);

  const prevReach = await prisma.analyticsSnapshot.aggregate({
    where: {
      workspaceId: opts.workspaceId,
      periodStart: { gte: prevFrom },
      periodEnd: { lte: prevTo },
      ...platformFilter(opts.platform),
    },
    _sum: { reach: true, engagement: true },
  });

  const currentReach = row._sum.reach ?? 0;
  const prevReachTotal = prevReach._sum.reach ?? 0;
  const reachGrowth = prevReachTotal > 0 ? ((currentReach - prevReachTotal) / prevReachTotal) * 100 : null;
  const currentEngagement = row._sum.engagement ?? 0;
  const prevEngagementTotal = prevReach._sum.engagement ?? 0;
  const engagementGrowth = prevEngagementTotal > 0 ? ((currentEngagement - prevEngagementTotal) / prevEngagementTotal) * 100 : null;

  return {
    totals: {
      reach: currentReach,
      impressions: row._sum.impressions ?? 0,
      engagement: currentEngagement,
      likes: row._sum.likes ?? 0,
      comments: row._sum.comments ?? 0,
      shares: row._sum.shares ?? 0,
      saves: row._sum.saves ?? 0,
      clicks: row._sum.clicks ?? 0,
    },
    snapshotsCount: row._count,
    followers: latestFollowers?.followers ?? 0,
    growth: {
      reachPercent: reachGrowth ? Math.round(reachGrowth * 10) / 10 : null,
      engagementPercent: engagementGrowth ? Math.round(engagementGrowth * 10) / 10 : null,
    },
  };
}

export async function getTimeSeries(opts: QueryOpts): Promise<AnalyticsTimeSeries[]> {
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: {
      workspaceId: opts.workspaceId,
      periodStart: { gte: opts.from },
      periodEnd: { lte: opts.to },
      ...platformFilter(opts.platform),
    },
    orderBy: { periodStart: "asc" },
    select: {
      periodStart: true,
      followers: true,
      reach: true,
      impressions: true,
      engagement: true,
      likes: true,
      comments: true,
      shares: true,
      saves: true,
      clicks: true,
    },
  });

  return snapshots.map((s) => ({
    date: s.periodStart.toISOString().slice(0, 10),
    followers: s.followers,
    reach: s.reach,
    impressions: s.impressions,
    engagement: s.engagement,
    likes: s.likes,
    comments: s.comments,
    shares: s.shares,
    saves: s.saves,
    clicks: s.clicks,
  }));
}

export async function getTopPosts(opts: QueryOpts & { limit?: number }): Promise<TopPostData[]> {
  const limit = opts.limit ?? 10;

  const results = await prisma.analyticsSnapshot.groupBy({
    by: ["postId"],
    where: {
      workspaceId: opts.workspaceId,
      postId: { not: null },
      periodStart: { gte: opts.from },
      periodEnd: { lte: opts.to },
      ...platformFilter(opts.platform),
    },
    _sum: {
      reach: true,
      impressions: true,
      engagement: true,
      likes: true,
      comments: true,
      shares: true,
      clicks: true,
    },
    orderBy: { _sum: { engagement: "desc" } },
    take: limit,
  });

  const postIds = results.filter((r) => r.postId).map((r) => r.postId!);
  if (postIds.length === 0) return [];

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds } },
    select: { id: true, title: true, content: true, publishedAt: true, socialAccount: { select: { platform: true } } },
  });
  const postMap = new Map(posts.map((p) => [p.id, p]));

  return results
    .filter((r): r is typeof r & { postId: string } => r.postId !== null)
    .map((r) => {
      const post = postMap.get(r.postId);
      return {
        postId: r.postId,
        title: post?.title ?? null,
        content: post?.content?.slice(0, 120) ?? "",
        platform: post?.socialAccount?.platform ?? null,
        impressions: r._sum.impressions ?? 0,
        engagement: r._sum.engagement ?? 0,
        likes: r._sum.likes ?? 0,
        comments: r._sum.comments ?? 0,
        shares: r._sum.shares ?? 0,
        clicks: r._sum.clicks ?? 0,
        publishedAt: post?.publishedAt ?? null,
      };
    });
}
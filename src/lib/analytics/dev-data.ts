import type { Platform } from "@/lib/integrations/types";
import type { SnapshotData } from "@/lib/analytics/types";

/**
 * Development-only: deterministic synthetic daily analytics snapshots for
 * a workspace + social account, used when ALLOW_DEV_PROVIDERS=true.
 * Clearly marked as simulated in all UI — never mixed with real data.
 */
export function generateDevSnapshots(opts: {
  workspaceId: string;
  accountId: string;
  platform: Platform;
  from: Date;
  to: Date;
  baseFollowers?: number;
}): SnapshotData[] {
  const { platform, from, to, baseFollowers = 200 } = opts;
  const now = new Date();
  const seed =
    Array.from(opts.workspaceId).reduce((s, c) => s + c.charCodeAt(0), 0) +
    Array.from(opts.accountId).reduce((s, c) => s + c.charCodeAt(0), 0);

  const days: SnapshotData[] = [];
  const start = new Date(from);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(23, 59, 59, 999);

  let followers = baseFollowers;
  let dayIndex = 0;

  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const r = pseudoRandom(seed + dayIndex);
    const dailyGrowth = 1 + Math.floor(pseudoRandom(seed + dayIndex + 1000) * 4);
    followers += dailyGrowth;

    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const reach = Math.floor(followers * (0.15 + r * 0.45) * (isWeekend ? 0.85 : 1));
    const impressions = Math.floor(reach * (1.2 + pseudoRandom(seed + dayIndex + 2000) * 0.8));
    const engagement = Math.floor(reach * (0.03 + pseudoRandom(seed + dayIndex + 3000) * 0.07));
    const likes = Math.floor(engagement * 0.55);
    const comments = Math.floor(engagement * 0.18);
    const shares = Math.floor(engagement * 0.15);
    const saves = Math.floor(engagement * 0.08);
    const clicks = Math.floor(engagement * 0.04);

    const periodStart = new Date(d);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCHours(23, 59, 59, 999);

    if (d.getTime() <= now.getTime()) {
      days.push({
        socialAccountId: opts.accountId,
        platform,
        periodStart,
        periodEnd,
        followers,
        reach,
        impressions,
        engagement,
        likes,
        comments,
        shares,
        saves,
        clicks,
      });
    }

    dayIndex++;
  }
  return days;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
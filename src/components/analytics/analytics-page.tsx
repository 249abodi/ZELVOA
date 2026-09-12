"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Icon, type IconName } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Summary {
  totals: {
    reach: number;
    impressions: number;
    engagement: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
  };
  followers: number;
  snapshotsCount: number;
  growth: {
    reachPercent: number | null;
    engagementPercent: number | null;
  };
}

interface TimePoint {
  date: string;
  followers: number;
  reach: number;
  impressions: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}

interface TopPost {
  postId: string;
  title: string | null;
  content: string;
  platform: string | null;
  impressions: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  publishedAt: string | null;
}

interface AnalyticsResponse {
  summary: Summary;
  timeSeries: TimePoint[];
}

interface PostsResponse {
  posts: TopPost[];
}

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const PLATFORM_OPTIONS = [
  { value: "", label: "All platforms" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "X", label: "X" },
];

function rangeDates(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from, to };
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function growthBadge(pct: number | null | undefined) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        up ? "text-emerald-500" : "text-red-500"
      )}
    >
      <Icon name={up ? "trend-up" : "arrow-down"} size={13} />
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  growth,
  icon,
}: {
  label: string;
  value: number;
  growth?: number | null;
  icon: IconName;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon name={icon} size={16} className="text-muted-foreground/60" />
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{fmt(value)}</div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        {growthBadge(growth)}
        <span>vs previous period</span>
      </div>
    </div>
  );
}

function BarChart({ points, metric }: { points: TimePoint[]; metric: keyof TimePoint }) {
  const max = Math.max(...points.map((p) => (p[metric] as number) ?? 0), 1);
  const width = 720;
  const height = 180;
  const pad = 8;
  const bw = (points.length === 0 ? 1 : width / points.length) * 0.6;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Chart">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1="0"
          x2={width}
          y1={height - height * f}
          y2={height - height * f}
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}
      {points.map((p, i) => {
        const value = (p[metric] as number) ?? 0;
        const x = i * (width / points.length) + pad / 2;
        const h = (value / max) * (height - pad);
        const y = height - h;
        return (
          <rect
            key={p.date + i}
            x={x}
            y={y}
            width={bw}
            height={h}
            rx="2"
            fill="var(--primary)"
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

export default function AnalyticsPageClient() {
  const { toastSuccess, toastError } = useToast();
  const [days, setDays] = useState("30");
  const [platform, setPlatform] = useState("");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [posts, setPosts] = useState<TopPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    skipped: number;
    devMode: boolean;
  } | null>(null);

  const from = useMemo(() => rangeDates(Number(days)).from.toISOString().slice(0, 10), [days]);
  const to = useMemo(() => rangeDates(Number(days)).to.toISOString().slice(0, 10), [days]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ from, to });
      if (platform) q.set("platform", platform);
      const [res, postsRes] = await Promise.all([
        fetch(`/api/v1/analytics?${q.toString()}`),
        fetch(`/api/v1/analytics/posts?${q.toString()}`),
      ]);
      if (!res.ok || !postsRes.ok) throw new Error("load_failed");
      const json = (await res.json()) as { data: AnalyticsResponse };
      const postsJson = (await postsRes.json()) as { data: PostsResponse };
      setData(json.data);
      setPosts(postsJson.data.posts);
    } catch {
      toastError("Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [from, to, platform, toastError]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/v1/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) throw new Error("sync_failed");
      const json = (await res.json()) as {
        data: { created: number; skipped: number; devMode: boolean; unsupported: { platform: string }[] };
      };
      setSyncResult(json.data);
      toastSuccess(
        json.data.created > 0
          ? `Synced ${json.data.created} daily snapshot${json.data.created === 1 ? "" : "s"}.`
          : "No new snapshots to add."
      );
      await load();
    } catch {
      toastError("Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const exportUrl = `/api/v1/analytics/export?${new URLSearchParams({ from, to }).toString()}${platform ? `&platform=${platform}` : ""}`;

  const summary = data?.summary ?? null;
  const series = data?.timeSeries ?? [];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Reach, engagement, and growth — from real captured snapshots."
        icon="analytics"
        actions={
          <>
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <Icon name="refresh" size={15} className={cn(syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync data"}
            </Button>
            <a href={exportUrl}>
              <Button variant="outline">
                <Icon name="download" size={15} />
                Export CSV
              </Button>
            </a>
          </>
        }
      />

      {syncResult && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Icon name="info" size={16} className="text-primary" />
          <span>
            {syncResult.devMode ? "Development snapshot data" : "Synced"} — {syncResult.created} created,{" "}
            {syncResult.skipped} skipped.
          </span>
          {syncResult.devMode && <Badge variant="warning">Dev data</Badge>}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Icon name="calendar" size={15} className="text-muted-foreground" />
          <Select value={days} onChange={(e) => setDays(e.target.value)} options={RANGE_OPTIONS} />
        </div>
        <div className="flex items-center gap-2">
          <Icon name="filter" size={15} className="text-muted-foreground" />
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)} options={PLATFORM_OPTIONS} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Icon name="spinner" size={16} className="animate-spin" />
          Loading analytics…
        </div>
      ) : summary === null || summary.snapshotsCount === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/30">
            <Icon name="analytics" size={24} />
          </div>
          <h2 className="mt-4 text-base font-semibold">No analytics yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Analytics appear once snapshots are captured. If you have a
            development account connected, use <span className="font-medium">Sync data</span> to
            generate simulated daily snapshots.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Followers" value={summary.followers} icon="users" />
            <StatCard label="Reach" value={summary.totals.reach} growth={summary.growth.reachPercent} icon="eye" />
            <StatCard
              label="Impressions"
              value={summary.totals.impressions}
              icon="analytics"
            />
            <StatCard
              label="Engagement"
              value={summary.totals.engagement}
              growth={summary.growth.engagementPercent}
              icon="zap"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Likes" value={summary.totals.likes} icon="target" />
            <StatCard label="Comments" value={summary.totals.comments} icon="mail" />
            <StatCard label="Shares" value={summary.totals.shares} icon="refresh" />
            <StatCard label="Clicks" value={summary.totals.clicks} icon="link" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Reach over time</h3>
              <span className="text-xs text-muted-foreground">daily snapshots</span>
            </div>
            <BarChart points={series} metric="reach" />
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-sm font-semibold">Top performing posts</h3>
              <span className="text-xs text-muted-foreground">by engagement</span>
            </div>
            {posts && posts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Post</th>
                      <th className="px-4 py-3 font-medium text-right">Impressions</th>
                      <th className="px-4 py-3 font-medium text-right">Engagement</th>
                      <th className="px-4 py-3 font-medium text-right">Likes</th>
                      <th className="px-4 py-3 font-medium text-right">Comments</th>
                      <th className="px-6 py-3 font-medium text-right">Shares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((p) => (
                      <tr key={p.postId} className="border-b border-border/60 last:border-0">
                        <td className="px-6 py-3">
                          <div className="line-clamp-1 max-w-xs font-medium">{p.title ?? p.content}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {p.platform ? p.platform.toLowerCase().replace("twitter", "x") : "platform"}
                            {p.publishedAt ? ` · ${p.publishedAt.slice(0, 10)}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(p.impressions)}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(p.engagement)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(p.likes)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(p.comments)}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{fmt(p.shares)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                No post-level data in this range yet. Post snapshots are recorded when posts go out.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
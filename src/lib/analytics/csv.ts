import type { AnalyticsTimeSeries } from "@/lib/analytics/types";

const HEADER = "date,followers,reach,impressions,engagement,likes,comments,shares,saves,clicks";

export function buildAnalyticsCsv(series: AnalyticsTimeSeries[]): string {
  const rows = series.map((s) =>
    [
      s.date,
      s.followers,
      s.reach,
      s.impressions,
      s.engagement,
      s.likes,
      s.comments,
      s.shares,
      s.saves,
      s.clicks,
    ].join(",")
  );
  return [HEADER, ...rows].join("\n");
}
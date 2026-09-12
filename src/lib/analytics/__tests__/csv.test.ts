import { describe, expect, test } from "vitest";
import { buildAnalyticsCsv } from "@/lib/analytics/csv";
import type { AnalyticsTimeSeries } from "@/lib/analytics/types";

const series: AnalyticsTimeSeries[] = [
  {
    date: "2026-01-01",
    followers: 200,
    reach: 100,
    impressions: 150,
    engagement: 20,
    likes: 12,
    comments: 3,
    shares: 2,
    saves: 1,
    clicks: 1,
  },
  {
    date: "2026-01-02",
    followers: 205,
    reach: 120,
    impressions: 180,
    engagement: 25,
    likes: 15,
    comments: 4,
    shares: 3,
    saves: 2,
    clicks: 1,
  },
];

describe("buildAnalyticsCsv", () => {
  test("emits header plus one row per snapshot", () => {
    const csv = buildAnalyticsCsv(series);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "date,followers,reach,impressions,engagement,likes,comments,shares,saves,clicks"
    );
  });

  test("rows are comma-separated numbers in column order", () => {
    const lines = buildAnalyticsCsv(series).split("\n");
    expect(lines[1]).toBe("2026-01-01,200,100,150,20,12,3,2,1,1");
    expect(lines[2]).toBe("2026-01-02,205,120,180,25,15,4,3,2,1");
  });

  test("empty series yields only the header", () => {
    expect(buildAnalyticsCsv([])).toBe(
      "date,followers,reach,impressions,engagement,likes,comments,shares,saves,clicks"
    );
  });
});
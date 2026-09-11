import { PhasePlaceholder } from "@/components/app/page-header";

export default function AnalyticsPage() {
  return (
    <PhasePlaceholder
      phase="Phase 4 — Analytics"
      title="Analytics"
      description="Clear, honest analytics for reach, engagement, and growth."
      icon="analytics"
      plannedFeatures={[
        "Followers, reach, impressions, engagement, likes, comments, shares, saves, clicks",
        "Charts: reach over time, engagement, followers growth, platform comparison",
        "Best performing posts",
        "Filters: 7, 30, 90 days and custom ranges",
        "Platform filter: all, Instagram, Facebook, TikTok, LinkedIn, X",
        "Best time to post recommendations — only from real data",
      ]}
    />
  );
}
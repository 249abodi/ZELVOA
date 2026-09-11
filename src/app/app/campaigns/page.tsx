import { PhasePlaceholder } from "@/components/app/page-header";

export default function CampaignsPage() {
  return (
    <PhasePlaceholder
      phase="Phase 8 — Campaigns"
      title="Campaigns"
      description="Plan, run, and report on structured campaigns."
      icon="campaigns"
      plannedFeatures={[
        "Campaign fields: name, description, start/end dates, platforms, goal, status",
        "Campaign dashboard with posts, reach, engagement, clicks",
        "Conversion data when available",
        "Link posts across platforms to a campaign",
      ]}
    />
  );
}
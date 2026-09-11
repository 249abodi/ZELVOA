import { PhasePlaceholder } from "@/components/app/page-header";

export default function ApprovalsPage() {
  return (
    <PhasePlaceholder
      phase="Phase 6 — Team"
      title="Approvals"
      description="Professional approval workflow with full audit records."
      icon="approvals"
      plannedFeatures={[
        "Flow: draft → pending approval → manager review → approved → scheduled → published",
        "Rejection path: pending approval → changes requested → draft",
        "Every approval action creates an audit record",
        "Role-based approval permissions enforced on the backend",
      ]}
    />
  );
}
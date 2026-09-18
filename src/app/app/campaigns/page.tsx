import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import CampaignsPageClient from "@/components/campaigns/campaigns-page";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const context = await getCurrentContext();
  const canManage = can(context?.role, "campaign.manage");
  return <CampaignsPageClient canManage={canManage} />;
}
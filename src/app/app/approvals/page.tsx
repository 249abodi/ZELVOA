import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import ApprovalsPageClient from "@/components/approvals/approvals-page";

export default async function ApprovalsPage() {
  const context = await getCurrentContext();
  const canApprove = can(context?.role, "post.approve");
  return <ApprovalsPageClient canApprove={canApprove} />;
}
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { PageSelection } from "@/components/accounts/page-selection";

export const metadata = { title: "Connect Accounts" };

export const dynamic = "force-dynamic";

export default async function SelectPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  const context = await getCurrentContext();
  if (!context) redirect("/login");

  const canManage = context.workspace ? can(context.role, "accounts.manage") : false;
  if (!canManage) redirect("/app/accounts");

  const params = await searchParams;
  if (!params.pending) redirect("/app/accounts?connect_error=pending_not_found");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Select Pages"
        description="Choose which Facebook Pages you want to connect to this workspace. Your selection is kept secure and expires in 10 minutes."
        icon="accounts"
        badge={undefined}
        actions={null}
      />
      <PageSelection pendingId={params.pending} />
    </div>
  );
}
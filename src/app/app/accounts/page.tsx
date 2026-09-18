import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { AccountsPageClient } from "@/components/accounts/accounts-page";

export const metadata = { title: "Accounts" };

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; connect_error?: string }>;
}) {
  const context = await getCurrentContext();
  if (!context) redirect("/login");

  const params = await searchParams;
  const notify =
    params.connect_error !== undefined
      ? { kind: "error" as const, message: params.connect_error }
      : params.connected !== undefined
        ? { kind: "connected" as const, message: params.connected }
        : null;

  const canManage = context.workspace ? can(context.role, "accounts.manage") : false;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Social Accounts"
        description="Connect the platforms you publish to. ZELVOA uses OAuth2 — provider tokens are encrypted at rest and never exposed."
        icon="accounts"
        badge={undefined}
        actions={null}
      />
      <AccountsPageClient
        canManage={canManage}
        notify={notify}
        isProduction={process.env.NODE_ENV === "production"}
        devProvidersAllowed={process.env.ALLOW_DEV_PROVIDERS === "true"}
      />
    </div>
  );
}
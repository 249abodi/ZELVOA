import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBillingInfo } from "@/lib/billing/limits";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import LicensePanel from "@/components/billing/license-panel";

export const dynamic = "force-dynamic";

interface UsageRow {
  label: string;
  used: number;
  max: number;
  exceeded: boolean;
}

function UsageBar({ row }: { row: UsageRow }) {
  const pct = row.max > 0 ? Math.min((row.used / row.max) * 100, 100) : 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{row.label}</span>
        <span className={cn("font-medium tabular-nums", row.exceeded ? "text-red-500" : "")}>
          {row.used}
          <span className="text-muted-foreground"> / {row.max}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", row.exceeded ? "bg-red-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function BillingPage() {
  const context = await getCurrentContext();
  if (!context) redirect("/login");

  const canManage = can(context?.role, "billing.manage");

  const [plans, billing] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    context.organization?.id ? getBillingInfo(context.organization.id) : null,
  ]);

  const subscription = billing?.subscription;
  const plan = billing?.plan;
  const check = billing?.check;

  const usageRows: UsageRow[] = check
    ? [
        {
          label: "Social accounts",
          used: check.usage.socialAccounts,
          max: check.limits.maxSocialAccounts,
          exceeded: check.exceeded.includes("maxSocialAccounts"),
        },
        {
          label: "Posts this month",
          used: check.usage.postsThisMonth,
          max: check.limits.maxPostsPerMonth,
          exceeded: check.exceeded.includes("maxPostsPerMonth"),
        },
        {
          label: "Team members",
          used: check.usage.teamMembers,
          max: check.limits.maxTeamMembers,
          exceeded: check.exceeded.includes("maxTeamMembers"),
        },
        {
          label: "Workspaces",
          used: check.usage.workspaces,
          max: check.limits.maxWorkspaces,
          exceeded: check.exceeded.includes("maxWorkspaces"),
        },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Your plan, subscription, and usage limits."
        icon="billing"
      />

      <Card className="mb-6 border-primary/30">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/30">
              <Icon name="crown" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{plan?.name ?? "Free"}</h2>
                <Badge variant="secondary">{subscription?.status ?? "free"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {plan ? `${plan.currency} ${plan.priceMonthly}/month`.replace("MYR 0", "Free") : "No active subscription"}
              </p>
            </div>
          </div>
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-lg border border-border-strong bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            Manage subscription
          </Link>
        </CardContent>
      </Card>

      {subscription && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
          <Icon name="info" size={14} className="text-primary" />
          Plan changes and a real payment provider are not connected yet. Subscriptions
          are tracked here but billing through a provider is coming soon.
        </p>
      )}

      {check && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Usage this month</CardTitle>
              <CardDescription>
                {check.ok
                  ? "Within plan limits."
                  : "One or more limits are exceeded."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {usageRows.map((row) => (
                <UsageBar key={row.label} row={row} />
              ))}
            </CardContent>
          </Card>
          <LicensePanel
            license={
              billing?.license
                ? {
                    ...billing.license,
                    expiresAt: billing.license.expiresAt
                      ? billing.license.expiresAt.toISOString()
                      : null,
                  }
                : null
            }
            canManage={canManage}
          />
        </div>
      )}

      <h2 className="mb-4 text-lg font-semibold">Available plans</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const current = subscription?.planId === p.id;
          return (
            <Card
              key={p.id}
              className={cn(
                "flex flex-col",
                current && "border-primary ring-1 ring-primary/30"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  {current && <Badge variant="default">Current</Badge>}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {p.currency} {p.priceMonthly}
                  </span>
                  <span className="text-xs text-muted-foreground">/month</span>
                </div>
                {p.description && <CardDescription>{p.description}</CardDescription>}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2 text-sm">
                <PlanFeature icon="accounts" text={`${p.maxSocialAccounts} social accounts`} />
                <PlanFeature icon="create" text={`${p.maxPostsPerMonth} posts/month`} />
                <PlanFeature icon="team" text={`${p.maxTeamMembers} team members`} />
                <PlanFeature icon="sparkles" text={p.aiAccess ? "AI Assistant" : "No AI access"} enabled={p.aiAccess} />
                <PlanFeature
                  icon="approvals"
                  text={p.approvalWorkflow ? "Approval workflow" : "No approvals"}
                  enabled={p.approvalWorkflow}
                />
                <PlanFeature
                  icon="database"
                  text={p.whiteLabel ? "White-label capabilities" : "No white-label"}
                  enabled={p.whiteLabel}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Plans are configurable through the backend (the{" "}
        <code className="rounded bg-muted px-1 py-0.5">Plan</code> model), not
        hard-coded in the UI.
      </p>
    </div>
  );
}

function PlanFeature({
  icon,
  text,
  enabled = true,
}: {
  icon: "accounts" | "create" | "team" | "sparkles" | "approvals" | "database";
  text: string;
  enabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon name={icon} size={15} className={enabled ? "text-success" : "text-muted-foreground/50"} />
      <span className={enabled ? "" : "text-muted-foreground/70 line-through"}>{text}</span>
    </div>
  );
}
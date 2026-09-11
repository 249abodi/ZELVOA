import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const context = await getCurrentContext();
  if (!context) redirect("/login");

  const [plans, subscription] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    context.organization?.id
      ? prisma.subscription.findUnique({
          where: { organizationId: context.organization.id },
          include: { plan: true },
        })
      : null,
  ]);

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Your plan and subscription."
        icon="billing"
      />

      {/* Current plan */}
      <Card className="mb-8 border-primary/30">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/30">
              <Icon name="crown" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">
                  {subscription?.plan.name ?? "Free"}
                </h2>
                <Badge variant="secondary">{subscription?.status ?? "TRIALING"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {subscription
                  ? `${subscription.plan.currency} ${subscription.plan.priceMonthly}/month`
                  : "No active subscription"}
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

      {/* Plans */}
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
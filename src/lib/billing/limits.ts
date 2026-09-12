import { prisma } from "@/lib/db";

export interface PlanLimits {
  maxSocialAccounts: number;
  maxPostsPerMonth: number;
  maxTeamMembers: number;
  maxWorkspaces: number;
}

export interface UsageSnapshot {
  socialAccounts: number;
  postsThisMonth: number;
  teamMembers: number;
  workspaces: number;
}

export interface LimitCheck {
  ok: boolean;
  exceeded: string[];
  limits: PlanLimits;
  usage: UsageSnapshot;
}

export function planLimitsFor(plan: {
  maxSocialAccounts: number;
  maxPostsPerMonth: number;
  maxTeamMembers: number;
  maxWorkspaces: number;
}): PlanLimits {
  return {
    maxSocialAccounts: plan.maxSocialAccounts,
    maxPostsPerMonth: plan.maxPostsPerMonth,
    maxTeamMembers: plan.maxTeamMembers,
    maxWorkspaces: plan.maxWorkspaces,
  };
}

export function evaluateLimits(limits: PlanLimits, usage: UsageSnapshot): LimitCheck {
  const exceeded: string[] = [];
  if (usage.socialAccounts > limits.maxSocialAccounts) exceeded.push("maxSocialAccounts");
  if (usage.postsThisMonth > limits.maxPostsPerMonth) exceeded.push("maxPostsPerMonth");
  if (usage.teamMembers > limits.maxTeamMembers) exceeded.push("maxTeamMembers");
  if (usage.workspaces > limits.maxWorkspaces) exceeded.push("maxWorkspaces");
  return { ok: exceeded.length === 0, exceeded, limits, usage };
}

export async function getEffectivePlan(organizationId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });
  if (subscription) return subscription.plan;
  return prisma.plan.findUnique({ where: { slug: "free" } });
}

export async function getUsageSnapshot(organizationId: string): Promise<UsageSnapshot> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [socialAccounts, postsThisMonth, teamMembers, workspaces] = await Promise.all([
    prisma.socialAccount.count({
      where: {
        workspace: { organizationId },
        status: { in: ["CONNECTED", "EXPIRED"] },
      },
    }),
    prisma.post.count({
      where: {
        workspace: { organizationId },
        createdAt: { gte: startOfMonth },
        deletedAt: null,
      },
    }),
    prisma.organizationMember.count({
      where: { organizationId, status: "ACTIVE" },
    }),
    prisma.workspace.count({
      where: { organizationId, deletedAt: null },
    }),
  ]);

  return { socialAccounts, postsThisMonth, teamMembers, workspaces };
}

export async function getBillingInfo(organizationId: string) {
  const [plan, subscription, usage, license] = await Promise.all([
    getEffectivePlan(organizationId),
    prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    }),
    getUsageSnapshot(organizationId),
    prisma.licenseKey.findUnique({ where: { organizationId } }),
  ]);

  const limits = plan ? planLimitsFor(plan) : null;
  const check = limits ? evaluateLimits(limits, usage) : null;

  return {
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          currency: plan.currency,
          limits: planLimitsFor(plan),
        }
      : null,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.planId,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          trialEndsAt: subscription.trialEndsAt,
        }
      : null,
    usage,
    check,
    license: license
      ? {
          id: license.id,
          key: maskLicenseKey(license.key),
          planSlug: license.planSlug,
          seats: license.seats,
          status: license.status,
          expiresAt: license.expiresAt,
        }
      : null,
  };
}

export function maskLicenseKey(key: string): string {
  const parts = key.split("-");
  if (parts.length !== 4) return "••••";
  return `ZELVOA-••••-••••-••••`;
}
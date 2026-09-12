import { getCurrentContext } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { handleApiError, unauthorized, fail, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!canAccessAdmin({ email: context.user?.email, role: context.role })) {
      return fail("Admin access is required.", 403);
    }

    const daysAgo = 29;
    const since = new Date();
    since.setDate(since.getDate() - daysAgo);

    const [orgsPerDay, signupsPerDay, recentAuditCount] = await Promise.all([
      prisma.organization.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    ]);

    const daily = new Map<string, { organizations: number; signups: number }>();
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      daily.set(d.toISOString().slice(0, 10), { organizations: 0, signups: 0 });
    }
    for (const row of orgsPerDay) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const entry = daily.get(key);
      if (entry) entry.organizations += 1;
    }
    for (const row of signupsPerDay) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const entry = daily.get(key);
      if (entry) entry.signups += 1;
    }

    return ok({
      daily: Array.from(daily.entries()).map(([date, counts]) => ({ date, ...counts })),
      auditEventsLast30Days: recentAuditCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
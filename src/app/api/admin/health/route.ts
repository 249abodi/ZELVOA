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

    let database = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }

    const startedAt = Date.now();
    const [organizations, workspaces, users, accounts, posts] = await Promise.all([
      prisma.organization.count({ where: { deletedAt: null } }),
      prisma.workspace.count({ where: { deletedAt: null } }),
      prisma.user.count(),
      prisma.socialAccount.count(),
      prisma.post.count({ where: { deletedAt: null } }),
    ]);

    return ok({
      status: database ? "healthy" : "degraded",
      database,
      counts: { organizations, workspaces, users, accounts, posts },
      version: process.env.npm_package_version ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      environment: process.env.NODE_ENV,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
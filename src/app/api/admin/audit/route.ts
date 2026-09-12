import { getCurrentContext } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { handleApiError, unauthorized, fail, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().optional(),
  entityType: z.string().optional(),
});

const PAGE_SIZE = 25;

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!canAccessAdmin({ email: context.user?.email, role: context.role })) {
      return fail("Admin access is required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      page: searchParams.get("page") ?? "1",
      limit: searchParams.get("limit") ?? `${PAGE_SIZE}`,
      action: searchParams.get("action") ?? undefined,
      entityType: searchParams.get("entityType") ?? undefined,
    });

    const where: Record<string, unknown> = {};
    if (parsed.action) where.action = parsed.action;
    if (parsed.entityType) where.entityType = parsed.entityType;

    const skip = (parsed.page - 1) * parsed.limit;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parsed.limit,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
          organization: { select: { id: true, name: true } },
          workspace: { select: { id: true, name: true } },
          actor: { select: { id: true, email: true, name: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return ok({
      logs,
      page: parsed.page,
      limit: parsed.limit,
      total,
      totalPages: Math.ceil(total / parsed.limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
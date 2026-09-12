import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleApiError, unauthorized, ok, parseJson } from "@/lib/api";
import { notificationsListQuerySchema, notificationsMarkReadSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();

    const { searchParams } = new URL(request.url);
    const parsed = notificationsListQuerySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
    });
    const limit = parsed.success ? (parsed.data.limit ?? 30) : 30;

    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: context.user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          data: true,
          readAt: true,
          createdAt: true,
          workspace: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.notification.count({ where: { userId: context.user.id } }),
      prisma.notification.count({ where: { userId: context.user.id, readAt: null } }),
    ]);

    return ok({ notifications, total, unread });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();

    const raw = await parseJson(request);
    const body = notificationsMarkReadSchema.parse(raw ?? {});

    const where = { userId: context.user.id };
    if (body.ids && body.ids.length > 0) {
      Object.assign(where, { id: { in: body.ids } });
    } else if (!body.all) {
      return ok({ updated: 0 });
    }

    const result = await prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return ok({ updated: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}
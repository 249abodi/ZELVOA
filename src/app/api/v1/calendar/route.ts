import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { calendarQuerySchema } from "@/lib/validators";
import { handleApiError, fail, unauthorized, ok } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.view")) {
      return fail("You do not have permission to view posts.", 403);
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");

    if (!from || !to) {
      return fail("from and to query parameters are required.", 400);
    }

    const parsed = calendarQuerySchema.parse({
      from,
      to,
      platform: platform || undefined,
      status: status || undefined,
    });

    const where: Record<string, unknown> = {
      workspaceId: context.workspace.id,
      deletedAt: null,
      OR: [
        {
          scheduledFor: {
            gte: new Date(parsed.from),
            lte: new Date(parsed.to),
          },
        },
        {
          scheduledPosts: {
            some: {
              scheduledFor: {
                gte: new Date(parsed.from),
                lte: new Date(parsed.to),
              },
            },
          },
        },
      ],
    };

    if (parsed.status) where.status = parsed.status;

    const posts = await prisma.post.findMany({
      where,
      orderBy: { scheduledFor: "asc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        socialAccount: { select: { platform: true, name: true } },
        variants: true,
        media: {
          include: { mediaAsset: { select: { id: true, fileName: true, type: true, storageKey: true, thumbnailKey: true } } },
          take: 1,
        },
        scheduledPosts: {
          select: {
            id: true,
            scheduledFor: true,
            status: true,
            platform: true,
            socialAccount: { select: { platform: true, name: true } },
          },
          where: parsed.platform
            ? { platform: parsed.platform as never }
            : undefined,
        },
      },
    });

    return ok(posts);
  } catch (error) {
    return handleApiError(error);
  }
}

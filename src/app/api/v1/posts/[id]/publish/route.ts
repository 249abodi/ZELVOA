import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, forbidden, unauthorized, ok, notFound, parseJson } from "@/lib/api";
import { publishPostSchema } from "@/lib/validators";
import { publishingService } from "@/lib/publishing/service";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.publish")) {
      return forbidden("You do not have permission to publish posts.");
    }

    const { id } = await params;
    const existing = await prisma.post.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
    });
    if (!existing) return notFound("Post not found.");

    const raw = await parseJson(request);
    const body = publishPostSchema.parse(raw ?? {});

    let targets: Awaited<ReturnType<typeof prisma.socialAccount.findMany>> = [];

    if (body.socialAccountIds && body.socialAccountIds.length > 0) {
      targets = await prisma.socialAccount.findMany({
        where: {
          workspaceId: context.workspace.id,
          status: "CONNECTED",
          id: { in: body.socialAccountIds },
        },
      });
    } else {
      const linked = await prisma.scheduledPost.findMany({
        where: { postId: id },
        select: { socialAccountId: true },
        distinct: ["socialAccountId"],
      });
      const linkedIds = linked
        .map((row) => row.socialAccountId)
        .filter((x): x is string => Boolean(x));
      if (linkedIds.length > 0) {
        targets = await prisma.socialAccount.findMany({
          where: { id: { in: linkedIds }, workspaceId: context.workspace.id, status: "CONNECTED" },
        });
      }
    }

    if (targets.length === 0) {
      return fail("No connected social accounts to publish to.", 400);
    }

    const now = Date.now();
    const createdRows = await prisma.scheduledPost.createMany({
      data: targets.map((account, index) => ({
        workspaceId: context.workspace!.id,
        postId: id,
        socialAccountId: account.id,
        platform: account.platform,
        scheduledFor: new Date(now),
        status: "PENDING",
        idempotencyKey: `${id}-${account.id}-publish-${now}-${index}`,
      })),
      skipDuplicates: true,
    });

    const rows = await prisma.scheduledPost.findMany({
      where: {
        postId: id,
        socialAccountId: { in: targets.map((t) => t.id) },
        status: { in: ["PENDING", "RETRYING"] },
      },
    });

    await prisma.post.update({
      where: { id },
      data: { status: "PROCESSING", scheduledFor: null } as never,
    });

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      postId: id,
      action: "post.publish_now",
      entityType: "Post",
      entityId: id,
      metadata: { targetCount: rows.length, createdRows: createdRows.count } as never,
    });

    const outcomes = [];
    for (const row of rows) {
      outcomes.push(await publishingService.publishScheduledPost(row.id));
    }

    return ok({ targetCount: rows.length, outcomes });
  } catch (error) {
    return handleApiError(error);
  }
}
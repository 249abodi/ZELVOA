import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { createPostSchema } from "@/lib/validators";
import { handleApiError, fail, forbidden, unauthorized, ok, created, parseJson } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.view")) {
      return forbidden("You do not have permission to view posts.");
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      workspaceId: context.workspace.id,
      deletedAt: null,
    };
    if (status) where.status = status;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, name: true } },
          socialAccount: { select: { platform: true, name: true } },
          variants: true,
          media: { include: { mediaAsset: { select: { id: true, fileName: true, type: true, storageKey: true } } } },
          scheduledPosts: {
            select: { scheduledFor: true, status: true, socialAccount: { select: { platform: true } } },
          },
          _count: { select: { approvals: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    return ok({
      posts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.create")) {
      return forbidden("You do not have permission to create posts.");
    }
    const workspaceId = context.workspace.id;

    const raw = await parseJson(request);
    const body = createPostSchema.parse(raw);

    const accounts = await prisma.socialAccount.findMany({
      where: {
        id: { in: body.socialAccountIds },
        workspaceId,
        status: "CONNECTED",
      },
    });
    if (accounts.length === 0) {
      return fail("No valid connected social accounts selected.", 400);
    }

    const post = await prisma.post.create({
      data: {
        workspaceId,
        createdById: context.user.id,
        updatedById: context.user.id,
        title: body.title,
        content: body.content,
        postType: body.postType ?? "STANDARD",
        status: body.scheduledFor ? "SCHEDULED" : "DRAFT",
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      },
    });

    const variantByPlatform = new Map(
      (body.variants ?? []).map((v) => [v.platform, v])
    );
    await prisma.postVariant.createMany({
      data: accounts.map((account) => {
        const variant = variantByPlatform.get(account.platform);
        return {
          postId: post.id,
          platform: account.platform,
          content: variant?.content ?? body.content,
          firstComment: variant?.firstComment,
        };
      }),
    });

    if (body.mediaAssetIds && body.mediaAssetIds.length > 0) {
      const validAssets = await prisma.mediaAsset.findMany({
        where: {
          id: { in: body.mediaAssetIds },
          workspaceId,
          deletedAt: null,
        },
      });
      if (validAssets.length > 0) {
        await prisma.postMedia.createMany({
          data: validAssets.map((a, i) => ({
            postId: post.id,
            mediaAssetId: a.id,
            position: i,
          })),
        });
      }
    }

    if (body.scheduledFor && accounts.length > 0) {
      const scheduledDate = new Date(body.scheduledFor);
      await prisma.scheduledPost.createMany({
        data: accounts.map((account) => ({
          workspaceId,
          postId: post.id,
          socialAccountId: account.id,
          platform: account.platform,
          scheduledFor: scheduledDate,
          idempotencyKey: `${post.id}-${account.id}-${scheduledDate.getTime()}`,
        })),
      });
    }

    const fullPost = await prisma.post.findUnique({
      where: { id: post.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        socialAccount: { select: { platform: true, name: true } },
        variants: true,
        media: { include: { mediaAsset: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: context.organization?.id,
        workspaceId: context.workspace.id,
        actorId: context.user.id,
        action: "post.created",
        entityType: "Post",
        postId: post.id,
        entityId: post.id,
        metadata: { title: post.title, status: post.status },
      },
    });

    return created(fullPost);
  } catch (error) {
    return handleApiError(error);
  }
}

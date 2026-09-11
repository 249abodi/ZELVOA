import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { updatePostSchema } from "@/lib/validators";
import { handleApiError, fail, forbidden, unauthorized, ok, notFound } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);

    const { id } = await params;
    const post = await prisma.post.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        updatedBy: { select: { id: true, name: true } },
        socialAccount: { select: { platform: true, name: true } },
        variants: true,
        media: {
          include: {
            mediaAsset: {
              select: {
                id: true,
                fileName: true,
                type: true,
                storageKey: true,
                thumbnailKey: true,
                mimeType: true,
                width: true,
                height: true,
              },
            },
          },
          orderBy: { position: "asc" },
        },
        scheduledPosts: {
          select: {
            id: true,
            scheduledFor: true,
            status: true,
            platform: true,
            publishedAt: true,
            socialAccount: { select: { platform: true, name: true } },
          },
          orderBy: { scheduledFor: "asc" },
        },
        approvals: {
          select: { id: true, status: true, requestedAt: true, resolvedAt: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!post) return notFound("Post not found.");
    return ok(post);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.edit")) {
      return forbidden("You do not have permission to edit posts.");
    }
    const workspaceId = context.workspace.id;

    const { id } = await params;
    const existing = await prisma.post.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing) return notFound("Post not found.");

    const raw = await request.json();
    const body = updatePostSchema.parse(raw);

    await prisma.post.update({
      where: { id },
      data: {
        updatedById: context.user.id,
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.postType !== undefined && { postType: body.postType }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.scheduledFor !== undefined && {
          scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        }),
      },
    });

    if (body.variants !== undefined || body.content !== undefined) {
      await prisma.postVariant.deleteMany({ where: { postId: id } });
      await prisma.postVariant.createMany({
        data: body.variants
          ? body.variants.map((v) => ({
              postId: id,
              platform: v.platform,
              content: v.content,
              firstComment: v.firstComment,
            }))
          : [],
      });
    }

    if (body.mediaAssetIds !== undefined) {
      await prisma.postMedia.deleteMany({ where: { postId: id } });
      if (body.mediaAssetIds.length > 0) {
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
              postId: id,
              mediaAssetId: a.id,
              position: i,
            })),
          });
        }
      }
    }

    if (body.socialAccountIds !== undefined && body.scheduledFor !== undefined) {
      await prisma.scheduledPost.deleteMany({ where: { postId: id } });
      const accounts = await prisma.socialAccount.findMany({
        where: {
          id: { in: body.socialAccountIds },
          workspaceId,
        },
      });
      if (accounts.length > 0 && body.scheduledFor) {
        const scheduledDate = new Date(body.scheduledFor);
        await prisma.scheduledPost.createMany({
          data: accounts.map((account) => ({
            workspaceId,
            postId: id,
            socialAccountId: account.id,
            platform: account.platform,
            scheduledFor: scheduledDate,
            idempotencyKey: `${id}-${account.id}-${scheduledDate.getTime()}`,
          })),
        });
      }
    }

    const fullPost = await prisma.post.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        variants: true,
        media: { include: { mediaAsset: true } },
      },
    });

    return ok(fullPost);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.delete")) {
      return forbidden("You do not have permission to delete posts.");
    }

    const { id } = await params;
    const existing = await prisma.post.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
    });
    if (!existing) return notFound("Post not found.");

    await prisma.post.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "DRAFT",
      },
    });

    await prisma.scheduledPost.deleteMany({ where: { postId: id } });

    await prisma.auditLog.create({
      data: {
        organizationId: context.organization?.id,
        workspaceId: context.workspace.id,
        actorId: context.user.id,
        action: "post.deleted",
        entityType: "Post",
        postId: id,
        entityId: id,
        metadata: { title: existing.title },
      },
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

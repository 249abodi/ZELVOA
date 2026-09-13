import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, unauthorized, ok, created, parseJson } from "@/lib/api";
import { z } from "zod";

const addMediaSchema = z.object({
  mediaAssetId: z.string(),
  position: z.number().int().min(0).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.view")) {
      return fail("You do not have permission to view post media.", 403);
    }

    const { id } = await params;
    const postMedia = await prisma.postMedia.findMany({
      where: { postId: id, post: { workspaceId: context.workspace.id } },
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
            sizeBytes: true,
          },
        },
      },
      orderBy: { position: "asc" },
    });

    return ok(postMedia);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.edit")) {
      return fail("You do not have permission to edit posts.", 403);
    }

    const { id } = await params;
    const post = await prisma.post.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
    });
    if (!post) return fail("Post not found.", 404);

    const raw = await parseJson(request);
    const body = addMediaSchema.parse(raw);

    const asset = await prisma.mediaAsset.findFirst({
      where: { id: body.mediaAssetId, workspaceId: context.workspace.id, deletedAt: null },
    });
    if (!asset) return fail("Media asset not found.", 404);

    const maxPos = await prisma.postMedia.aggregate({
      where: { postId: id },
      _max: { position: true },
    });

    const postMedia = await prisma.postMedia.create({
      data: {
        postId: id,
        mediaAssetId: body.mediaAssetId,
        position: body.position ?? (maxPos._max.position ?? -1) + 1,
      },
      include: { mediaAsset: true },
    });

    return created(postMedia);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.edit")) {
      return fail("You do not have permission to edit posts.", 403);
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mediaAssetId = searchParams.get("mediaAssetId");
    if (!mediaAssetId) return fail("mediaAssetId is required.", 400);

    await prisma.postMedia.deleteMany({
      where: { postId: id, mediaAssetId },
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

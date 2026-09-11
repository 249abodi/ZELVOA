import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { updateMediaAssetSchema } from "@/lib/validators";
import { handleApiError, fail, forbidden, unauthorized, ok, notFound, parseJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage/factory";
import { sanitizeFileName } from "@/lib/storage/keys";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);

    const { id } = await params;
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
      include: {
        uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
        folder: { select: { id: true, name: true } },
      },
    });

    if (!asset) return notFound("Media asset not found.");
    return ok(asset);
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
    if (!can(context.role, "media.manage")) {
      return forbidden("You do not have permission to manage media.");
    }

    const { id } = await params;
    const existing = await prisma.mediaAsset.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
    });
    if (!existing) return notFound("Media asset not found.");

    const raw = await parseJson(request);
    const body = updateMediaAssetSchema.parse(raw);

    const data: Record<string, unknown> = {};
    if (body.altText !== undefined) data.altText = body.altText;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.folderId !== undefined) data.folderId = body.folderId;
    if (body.fileName !== undefined) data.fileName = sanitizeFileName(body.fileName);

    const asset = await prisma.mediaAsset.update({
      where: { id },
      data,
    });

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "media.updated",
      entityType: "MediaAsset",
      entityId: id,
      mediaAssetId: id,
      metadata: { changed: Object.keys(data) },
    });

    return ok(asset);
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
    if (!can(context.role, "media.manage")) {
      return forbidden("You do not have permission to manage media.");
    }

    const { id } = await params;
    const existing = await prisma.mediaAsset.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
    });
    if (!existing) return notFound("Media asset not found.");

    const inUse = await prisma.postMedia.findFirst({
      where: { mediaAssetId: id },
    });
    if (inUse) {
      return fail("Cannot delete media that is attached to a post.", 409);
    }

    await prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    const storage = getStorage();
    await storage.delete(existing.storageKey).catch(() => undefined);
    if (existing.thumbnailKey) {
      await storage.delete(existing.thumbnailKey).catch(() => undefined);
    }

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "media.deleted",
      entityType: "MediaAsset",
      entityId: id,
      mediaAssetId: id,
      metadata: { fileName: existing.fileName },
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

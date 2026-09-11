import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { updateMediaFolderSchema } from "@/lib/validators";
import { handleApiError, fail, forbidden, unauthorized, ok, notFound, parseJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { sanitizeDirectoryName } from "@/lib/storage/keys";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "media.manage")) {
      return forbidden("You do not have permission to manage media folders.");
    }

    const { id } = await params;
    const folder = await prisma.mediaFolder.findFirst({
      where: { id, workspaceId: context.workspace.id },
    });
    if (!folder) return notFound("Folder not found.");

    const raw = await parseJson(request);
    const body = updateMediaFolderSchema.parse(raw);

    if (body.parentId === folder.id) {
      return fail("A folder cannot be its own parent.", 400);
    }

    if (body.parentId != null) {
      const parent = await prisma.mediaFolder.findFirst({
        where: { id: body.parentId, workspaceId: context.workspace.id },
      });
      if (!parent) return fail("Parent folder not found.", 400);
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = sanitizeDirectoryName(body.name);
    if (body.parentId !== undefined) data.parentId = body.parentId;

    try {
      const updated = await prisma.mediaFolder.update({ where: { id }, data });
      await writeAudit({
        organizationId: context.organization?.id,
        workspaceId: context.workspace.id,
        actorId: context.user.id,
        action: "media.folder_updated",
        entityType: "MediaFolder",
        entityId: id,
        metadata: { changed: Object.keys(data) },
      });
      return ok(updated);
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return fail("A folder with this name already exists here.", 409);
      }
      throw err;
    }
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
      return forbidden("You do not have permission to manage media folders.");
    }

    const { id } = await params;
    const folder = await prisma.mediaFolder.findFirst({
      where: { id, workspaceId: context.workspace.id },
    });
    if (!folder) return notFound("Folder not found.");

    // Promote children + assets to the deleted folder's parent, then remove it.
    await prisma.$transaction([
      prisma.mediaAsset.updateMany({
        where: { folderId: id },
        data: { folderId: folder.parentId },
      }),
      prisma.mediaFolder.updateMany({
        where: { parentId: id },
        data: { parentId: folder.parentId },
      }),
      prisma.mediaFolder.delete({ where: { id } }),
    ]);

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "media.folder_deleted",
      entityType: "MediaFolder",
      entityId: id,
      metadata: { name: folder.name },
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
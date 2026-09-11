import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, forbidden, unauthorized, ok, parseJson } from "@/lib/api";
import { bulkMediaActionSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "media.manage")) {
      return forbidden("You do not have permission to manage media.");
    }

    const raw = await parseJson(request);
    const body = bulkMediaActionSchema.parse(raw);

    const assets = await prisma.mediaAsset.findMany({
      where: { id: { in: body.ids }, workspaceId: context.workspace.id, deletedAt: null },
      select: { id: true, fileName: true },
    });
    if (assets.length === 0) return fail("No matching media found.", 404);

    const ids = assets.map((a) => a.id);

    if (body.action === "delete") {
      const inUse = await prisma.postMedia.findFirst({ where: { mediaAssetId: { in: ids } } });
      if (inUse) {
        return fail("Some media is attached to posts and cannot be deleted.", 409);
      }
      await prisma.mediaAsset.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date() },
      });
      await writeAudit({
        organizationId: context.organization?.id,
        workspaceId: context.workspace.id,
        actorId: context.user.id,
        action: "media.bulk_deleted",
        entityType: "MediaAsset",
        entityId: ids[0],
        metadata: { ids, count: assets.length },
      });
      return ok({ deleted: assets.length });
    }

    if (body.action === "move") {
      if (body.folderId) {
        const folder = await prisma.mediaFolder.findFirst({
          where: { id: body.folderId, workspaceId: context.workspace.id },
        });
        if (!folder) return fail("Target folder not found.", 400);
      }
      await prisma.mediaAsset.updateMany({
        where: { id: { in: ids } },
        data: { folderId: body.folderId ?? null },
      });
      await writeAudit({
        organizationId: context.organization?.id,
        workspaceId: context.workspace.id,
        actorId: context.user.id,
        action: "media.bulk_moved",
        entityType: "MediaAsset",
        entityId: ids[0],
        metadata: { ids, folderId: body.folderId ?? null, count: assets.length },
      });
      return ok({ moved: assets.length });
    }

    if (body.action === "tag") {
      const tags = body.tags ?? [];
      const existing = await prisma.mediaAsset.findMany({
        where: { id: { in: ids } },
        select: { id: true, tags: true },
      });
      const currentTags = new Set<string>();
      existing.forEach((a) => a.tags.forEach((t) => currentTags.add(t)));
      tags.forEach((t) => currentTags.add(t));
      const merged = Array.from(currentTags);

      await prisma.mediaAsset.updateMany({
        where: { id: { in: ids } },
        data: { tags: merged },
      });
      await writeAudit({
        organizationId: context.organization?.id,
        workspaceId: context.workspace.id,
        actorId: context.user.id,
        action: "media.bulk_tagged",
        entityType: "MediaAsset",
        entityId: ids[0],
        metadata: { ids, tags, count: assets.length },
      });
      return ok({ tagged: assets.length });
    }

    return fail("Unsupported bulk action.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
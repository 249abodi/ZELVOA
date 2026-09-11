import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { createMediaFolderSchema } from "@/lib/validators";
import { handleApiError, fail, forbidden, unauthorized, ok, created, parseJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { sanitizeDirectoryName } from "@/lib/storage/keys";

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "media.view")) {
      return forbidden("You do not have permission to view media.");
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    const folders = await prisma.mediaFolder.findMany({
      where: {
        workspaceId: context.workspace.id,
        ...(parentId === "null" || parentId === "none"
          ? { parentId: null }
          : parentId
            ? { parentId }
            : {}),
      },
      orderBy: { name: "asc" },
      include: { _count: { select: { assets: true, children: true } } },
    });

    const trees = await prisma.mediaFolder.findMany({
      where: { workspaceId: context.workspace.id },
      select: { id: true, name: true, parentId: true },
    });

    return ok({ folders, trees });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "media.manage")) {
      return forbidden("You do not have permission to manage media folders.");
    }

    const raw = await parseJson(request);
    const body = createMediaFolderSchema.parse(raw);

    let parentId: string | null = null;
    if (body.parentId) {
      const parent = await prisma.mediaFolder.findFirst({
        where: { id: body.parentId, workspaceId: context.workspace.id },
      });
      if (!parent) return fail("Parent folder not found.", 400);
      parentId = parent.id;
    }

    const name = sanitizeDirectoryName(body.name);
    try {
      const folder = await prisma.mediaFolder.create({
        data: {
          workspaceId: context.workspace.id,
          name,
          parentId,
          createdById: context.user.id,
        },
      });
      await writeAudit({
        organizationId: context.organization?.id,
        workspaceId: context.workspace.id,
        actorId: context.user.id,
        action: "media.folder_created",
        entityType: "MediaFolder",
        entityId: folder.id,
        metadata: { name, parentId },
      });
      return created(folder);
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
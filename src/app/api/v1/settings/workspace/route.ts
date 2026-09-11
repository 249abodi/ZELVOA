import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { z } from "zod";
import { handleApiError, fail, forbidden, unauthorized, ok } from "@/lib/api";

const workspaceSchema = z.object({
  name: z.string().min(2).max(100),
  timezone: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "workspace.manage")) {
      return forbidden("You do not have permission to manage workspace settings.");
    }

    const raw = await request.json();
    const body = workspaceSchema.parse(raw);

    const workspace = await prisma.workspace.update({
      where: { id: context.workspace.id },
      data: { name: body.name, timezone: body.timezone },
      select: { id: true, name: true, timezone: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: context.organization?.id,
        workspaceId: workspace.id,
        actorId: context.user.id,
        action: "settings.workspace.updated",
        entityType: "Workspace",
        entityId: workspace.id,
      },
    });

    return ok({ workspace });
  } catch (error) {
    return handleApiError(error);
  }
}
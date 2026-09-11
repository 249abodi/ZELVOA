import { prisma } from "@/lib/db";
import { getCurrentContext, SESSION_COOKIE } from "@/lib/auth";
import { signSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { createWorkspaceSchema } from "@/lib/validators";
import { handleApiError, fail, forbidden, unauthorized, created } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.organization) return fail("No organization for this user.", 400);
    if (!can(context.role, "workspace.manage")) {
      return forbidden("You do not have permission to manage workspaces.");
    }

    const raw = await request.json();
    const body = createWorkspaceSchema.parse(raw);

    const slug =
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 50) || "workspace";

    const workspace = await prisma.workspace.create({
      data: {
        organizationId: context.organization.id,
        name: body.name.trim(),
        slug,
        timezone: body.timezone,
        defaultLocale: body.defaultLocale,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: context.organization.id,
        workspaceId: workspace.id,
        actorId: context.user.id,
        action: "workspace.created",
        entityType: "Workspace",
        entityId: workspace.id,
        metadata: { name: workspace.name },
      },
    });

    const token = await signSession({
      sub: context.user.id,
      org: context.organization.id,
      ws: workspace.id,
      role: context.role ?? undefined,
    });

    const response = created(workspace);
    response.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
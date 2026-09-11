import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "inbox.assign")) {
      return fail("You do not have permission to assign conversations.", 403);
    }
    if (!context.organization) return ok({ assignees: [] });

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: context.organization.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: "asc" },
    });

    return ok({
      assignees: members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
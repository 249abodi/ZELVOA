import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, forbidden, unauthorized, ok, parseJson } from "@/lib/api";
import { revokeInvitationSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.organization) return fail("No organization selected.", 400);
    if (!can(context.role, "member.invite")) {
      return forbidden("You do not have permission to manage invitations.");
    }

    const raw = await parseJson(request);
    const body = revokeInvitationSchema.parse(raw);

    const invitation = await prisma.invitation.findFirst({
      where: {
        id: body.id,
        organizationId: context.organization.id,
        status: "PENDING",
      },
      select: { id: true, email: true, workspaceId: true },
    });
    if (!invitation) return fail("Pending invitation not found.", 404);

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "REVOKED" },
    });

    await writeAudit({
      organizationId: context.organization.id,
      workspaceId: invitation.workspaceId,
      actorId: context.user.id,
      action: "member.invitation_revoked",
      entityType: "Invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email },
    });

    return ok({ id: invitation.id, status: "REVOKED" });
  } catch (error) {
    return handleApiError(error);
  }
}
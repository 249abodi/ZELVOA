import { prisma } from "@/lib/db";
import { handleApiError, notFound, ok } from "@/lib/api";
import { getCurrentContext } from "@/lib/auth";
import { findInvitationForToken, isInvitationValid } from "@/lib/invitations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) return notFound("Invitation not found.");

    const invitation = await findInvitationForToken(token);
    if (!invitation) return notFound("Invitation not found.");

    const context = await getCurrentContext();
    const isExpired = !isInvitationValid(invitation);

    const organization = await prisma.organization.findUnique({
      where: { id: invitation.organizationId },
      select: { id: true, name: true, slug: true },
    });
    const workspace = await prisma.workspace.findUnique({
      where: { id: invitation.workspaceId },
      select: { id: true, name: true },
    });

    return ok({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        createdById: invitation.invitedById,
      },
      organization,
      workspace,
      isValid: !isExpired,
      isLoggedIn: Boolean(context),
      userEmail: context?.user.email ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
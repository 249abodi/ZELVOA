import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, forbidden, unauthorized, ok, created, parseJson } from "@/lib/api";
import { createInvitationSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import {
  generateInviteToken,
  hashInviteToken,
  buildInviteUrl,
  getInviteBaseUrl,
  INVITATION_TTL_DAYS,
  INVITE_ROLES,
} from "@/lib/invitations";
import { getUsageSnapshot, getEffectivePlan } from "@/lib/billing/limits";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.organization) return fail("No organization selected.", 400);
    if (!can(context.role, "member.invite")) {
      return forbidden("You do not have permission to invite members.");
    }

    const raw = await parseJson(request);
    const body = createInvitationSchema.parse(raw);
    const email = body.email.toLowerCase().trim();
    const workspaceId = context.workspace?.id;

    if (!workspaceId) return fail("No workspace selected.", 400);

    const existingMember = await prisma.organizationMember.findFirst({
      where: { organizationId: context.organization.id, user: { email } },
      select: { id: true, status: true },
    });
    if (existingMember) {
      return fail("This person is already a member of your organization.", 409);
    }

    const pending = await prisma.invitation.findFirst({
      where: {
        organizationId: context.organization.id,
        email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (pending) {
      return fail("This person already has a pending invitation.", 409);
    }

    const plan = await getEffectivePlan(context.organization.id);
    if (plan) {
      const usage = await getUsageSnapshot(context.organization.id);
      const currentMembers = usage.teamMembers;
      const pendingCount = await prisma.invitation.count({
        where: {
          organizationId: context.organization.id,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      });
      if (currentMembers + pendingCount >= plan.maxTeamMembers) {
        return fail(
          `Your plan allows up to ${plan.maxTeamMembers} team members.`,
          403
        );
      }
    }

    const token = generateInviteToken();
    const expiresAt = new Date(
      Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: context.organization.id,
        workspaceId,
        email,
        role: body.role,
        tokenHash: hashInviteToken(token),
        invitedById: context.user.id,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
      },
    });

    await writeAudit({
      organizationId: context.organization.id,
      workspaceId,
      actorId: context.user.id,
      action: "member.invited",
      entityType: "Invitation",
      entityId: invitation.id,
      metadata: { email, role: body.role, expiresAt: expiresAt.toISOString() },
    });

    return created({
      invitation: {
        ...invitation,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      inviteUrl: buildInviteUrl(getInviteBaseUrl(request), token),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.organization) return fail("No organization selected.", 400);
    if (!can(context.role, "member.invite")) {
      return forbidden("You do not have permission to manage invitations.");
    }

    const now = new Date();
    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: context.organization.id,
        status: "PENDING",
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        invitedById: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return ok({
      invitations: invitations.map((inv) => ({
        ...inv,
        expired: inv.expiresAt.getTime() <= now.getTime(),
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
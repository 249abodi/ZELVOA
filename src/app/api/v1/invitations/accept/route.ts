import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext, SESSION_COOKIE } from "@/lib/auth";
import { handleApiError, fail, unauthorized, parseJson } from "@/lib/api";
import { acceptInvitationSchema } from "@/lib/validators";
import { findInvitationForToken, isInvitationValid } from "@/lib/invitations";
import { signSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();

    const raw = await parseJson(request);
    const body = acceptInvitationSchema.parse(raw);

    const invitation = await findInvitationForToken(body.token);
    if (!invitation || !isInvitationValid(invitation)) {
      return fail("This invitation is invalid or has expired.", 404);
    }

    const userEmail = context.user.email.toLowerCase().trim();
    if (userEmail !== invitation.email.toLowerCase().trim()) {
      return fail(
        "This invitation was sent to a different email address. Please log in with the correct account.",
        403
      );
    }

    const existingMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId: invitation.organizationId,
        user: { email: userEmail },
      },
      select: { id: true, status: true },
    });
    if (existingMember && existingMember.status === "ACTIVE") {
      return fail("You are already a member of this organization.", 409);
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: invitation.workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      return fail("The workspace for this invitation no longer exists.", 410);
    }

    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptedUserId: context.user.id,
        },
      });

      if (existingMember) {
        await tx.organizationMember.update({
          where: { id: existingMember.id },
          data: { role: invitation.role, status: "ACTIVE", joinedAt: new Date() },
        });
      } else {
        await tx.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: context.user.id,
            role: invitation.role,
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        });
      }
    });

    await writeAudit({
      organizationId: invitation.organizationId,
      workspaceId: invitation.workspaceId,
      actorId: context.user.id,
      action: "member.joined",
      entityType: "Invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    });

    const token = await signSession({
      sub: context.user.id,
      org: invitation.organizationId,
      ws: invitation.workspaceId,
      role: invitation.role,
    });

    const response = NextResponse.json({
      data: {
        organizationId: invitation.organizationId,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
      },
    });
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
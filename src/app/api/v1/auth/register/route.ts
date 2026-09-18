import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { signSession } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { handleApiError, fail, created } from "@/lib/api";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { findInvitationForToken, isInvitationValid } from "@/lib/invitations";

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50) || "zelvoa"
  );
}

export async function POST(request: Request) {
  const rate = checkAuthRateLimit(request);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { message: "Too many attempts. Try again later." } },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const raw = await request.json();
    const body = registerSchema.parse(raw);
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return fail("An account with this email already exists.", 409);
    }

    const invitation = body.inviteToken
      ? await findInvitationForToken(body.inviteToken)
      : null;
    if (body.inviteToken) {
      if (!invitation || !isInvitationValid(invitation)) {
        return fail("This invitation is invalid or has expired.", 400);
      }
      if (invitation.email.toLowerCase() !== email) {
        return fail("This invitation was sent to a different email address.", 403);
      }
    }

    const passwordHash = hashPassword(body.password);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: body.name.trim(),
          timezone: body.timezone ?? "UTC",
          locale: body.locale ?? "en",
        },
      });

      await tx.userSettings.create({ data: { userId: createdUser.id } });

      if (invitation) {
        await tx.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: createdUser.id,
            role: invitation.role,
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
            acceptedUserId: createdUser.id,
          },
        });

        return {
          ...createdUser,
          organizationId: invitation.organizationId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        };
      }

      const orgName =
        body.organizationName?.trim() || `${body.name.trim()}'s workspace`;

      const organization = await tx.organization.create({
        data: {
          name: orgName,
          slug: slugify(orgName),
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          organizationId: organization.id,
          name: orgName,
          slug: "default",
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: createdUser.id,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      });

      const freePlan = await tx.plan.findUnique({ where: { slug: "free" } });
      if (freePlan) {
        const now = new Date();
        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planId: freePlan.id,
            status: "TRIALING",
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            trialEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          workspaceId: workspace.id,
          actorId: createdUser.id,
          action: "organization.created",
          entityType: "Organization",
          entityId: organization.id,
          metadata: { name: orgName },
        },
      });

      return { ...createdUser, organizationId: organization.id, workspaceId: workspace.id, role: "OWNER" };
    });

    const token = await signSession({
      sub: user.id,
      org: user.organizationId,
      ws: user.workspaceId,
      role: user.role,
    });

    const response = created({
      user: { id: user.id, email: user.email, name: user.name },
      organizationId: user.organizationId,
      workspaceId: user.workspaceId,
      role: user.role,
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
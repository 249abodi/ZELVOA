import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { signSession } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { handleApiError, fail, ok } from "@/lib/api";

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

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const body = loginSchema.parse(raw);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return fail("Invalid email or password.", 401);
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        status: { not: "REMOVED" },
      },
      select: { organizationId: true, role: true },
      orderBy: { createdAt: "asc" },
    });

    const workspace = membership
      ? await prisma.workspace.findFirst({
          where: { organizationId: membership.organizationId },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        })
      : null;

    const token = await signSession({
      sub: user.id,
      org: membership?.organizationId,
      ws: workspace?.id,
      role: membership?.role ?? undefined,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: membership?.organizationId,
        actorId: user.id,
        action: "auth.login",
        entityType: "User",
        entityId: user.id,
      },
    });

    const response = ok({
      user: { id: user.id, email: user.email, name: user.name },
      organizationId: membership?.organizationId ?? null,
      workspaceId: workspace?.id ?? null,
      role: membership?.role ?? null,
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { decryptSecret, hashPassword } from "@/lib/crypto";
import { signSession } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/auth";
import {
  exchangeCode,
  fetchProfile,
  isLoginProvider,
  sanitizeNext,
  syntheticEmail,
  type LoginProvider,
  type SocialProfile,
} from "@/lib/social-auth";

function redirectTo(origin: string, path: string, error?: string): NextResponse {
  const url = new URL(path, origin);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: raw } = await params;
  const provider = raw.toUpperCase();
  if (!isLoginProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }

  const url = new URL(request.url);
  const origin = url.origin;

  if (url.searchParams.has("error") || url.searchParams.has("denied")) {
    return redirectTo(origin, "/login", "oauth_denied");
  }

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state) return redirectTo(origin, "/login", "invalid_state");
  if (!code) return redirectTo(origin, "/login", "missing_code");

  const stateRow = await prisma.authOAuthState.findUnique({ where: { state } });
  if (!stateRow || stateRow.provider !== provider) {
    return redirectTo(origin, "/login", "invalid_state");
  }
  if (stateRow.consumedAt) return redirectTo(origin, "/login", "state_used");
  if (stateRow.expiresAt.getTime() <= Date.now()) {
    return redirectTo(origin, "/login", "state_expired");
  }

  const consumed = await prisma.authOAuthState.updateMany({
    where: { id: stateRow.id, consumedAt: null },
    data: { consumedAt: new Date(), codeVerifier: null },
  });
  if (consumed.count === 0) return redirectTo(origin, "/login", "state_used");

  let profile: SocialProfile;
  try {
    const accessToken = await exchangeCode({
      provider,
      code,
      redirectUri: stateRow.redirectUri,
      codeVerifier:
        provider === "X" && stateRow.codeVerifier
          ? decryptSecret(stateRow.codeVerifier)
          : stateRow.codeVerifier,
    });
    profile = await fetchProfile(provider, accessToken);
  } catch {
    return redirectTo(origin, "/login", "oauth_failed");
  }
  if (!profile.providerAccountId) {
    return redirectTo(origin, "/login", "oauth_failed");
  }

  let user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null = null;

  const existingConnection = await prisma.authProviderAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existingConnection) {
    if (existingConnection.user.deletedAt) {
      return redirectTo(origin, "/login", "account_disabled");
    }
    user = existingConnection.user;
  } else {
    user = await resolveNewIdentity(provider, profile);
    if (!user) return redirectTo(origin, "/login", "oauth_conflict");
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
    data: {
      lastLoginAt: new Date(),
      ...(profile.avatarUrl && !user.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: membership?.organizationId,
      actorId: user.id,
      action: "auth.login.social",
      entityType: "User",
      entityId: user.id,
      metadata: { provider },
    },
  });

  const target = sanitizeNext(stateRow.next) ?? "/app/dashboard";
  const response = NextResponse.redirect(new URL(target, origin));
  setSessionCookie(response, token);
  return response;
}

async function resolveNewIdentity(
  provider: LoginProvider,
  profile: SocialProfile
): Promise<{ id: string; email: string; name: string; avatarUrl: string | null } | null> {
  const email = profile.email?.toLowerCase() ?? null;

  if (email && profile.emailVerified) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, avatarUrl: true, deletedAt: true },
    });
    if (existingUser && !existingUser.deletedAt) {
      const linked = await safeCreateProviderAccount(
        existingUser.id,
        provider,
        profile
      );
      if (!linked) return null;
      return existingUser;
    }
  }

  const emailConflict = email
    ? Boolean(
        await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        })
      )
    : false;
  if (emailConflict) return null;

  const finalEmail = email ?? syntheticEmail(provider, profile.providerAccountId);
  try {
    const created = await prisma.user.create({
      data: {
        email: finalEmail,
        passwordHash: hashPassword(`${randomBytes(24).toString("base64url")}-sso`),
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        emailVerified: profile.emailVerified,
      },
    });
    const linked = await safeCreateProviderAccount(created.id, provider, profile);
    if (!linked) return null;
    return created;
  } catch {
    return null;
  }
}

async function safeCreateProviderAccount(
  userId: string,
  provider: LoginProvider,
  profile: SocialProfile
): Promise<boolean> {
  try {
    await prisma.authProviderAccount.create({
      data: {
        userId,
        provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email?.toLowerCase(),
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        emailVerified: profile.emailVerified,
      },
    });
    return true;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") return false;
    throw err;
  }
}

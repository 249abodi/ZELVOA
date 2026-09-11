import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { callbackQuerySchema } from "@/lib/validators";
import { getProvider } from "@/lib/integrations/factory";
import { encryptSecret } from "@/lib/crypto";
import { markDev, isDevMarkerScope } from "@/lib/integrations/dev-provider";
import { writeAudit } from "@/lib/audit";
import { assessOAuthState, buildAccountsRedirect } from "@/lib/integrations/oauth";

function redirectToApp(state: string, error?: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(
    buildAccountsRedirect(state, { base, error, connected: !error })
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = {
    platform: searchParams.get("platform") ?? "",
    state: searchParams.get("state") ?? "",
    code: searchParams.get("code") ?? undefined,
    error: searchParams.get("error") ?? undefined,
    error_description: searchParams.get("error_description") ?? undefined,
    devToken: searchParams.get("dev_token") ?? undefined,
  };
  if (!raw.state) return redirectToApp("", "missing_oauth_state");

  const parsed = callbackQuerySchema.safeParse(raw);
  if (!parsed.success) return redirectToApp(raw.state, "invalid_oauth_callback");

  const body = parsed.data;

  try {
    const record = await prisma.oAuthState.findUnique({ where: { state: body.state } });
    const assessed = assessOAuthState(record, new Date());

    if (!record || assessed.missing) {
      return redirectToApp(body.state, assessed.error ?? "invalid_oauth_state");
    }

    if (body.error) {
      await prisma.oAuthState.delete({ where: { id: record.id } });
      const message = body.error_description || body.error;
      return redirectToApp(body.state, message);
    }

    if (assessed.error) {
      if (assessed.error === "oauth_state_expired") {
        await prisma.oAuthState.delete({ where: { id: record.id } });
      }
      return redirectToApp(body.state, assessed.error);
    }

    // The workspace is derived from the server-persisted state — never from the
    // client. The authenticated user must belong to that organization.
    const context = await getCurrentContext();
    if (!context) return redirectToApp(body.state, "unauthenticated");
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: record.organizationId,
        userId: context.user.id,
      },
    });
    if (!member) return redirectToApp(body.state, "not_a_member");

    const provider = getProvider(record.platform);
    const exchanged = await provider.exchangeCode(
      body.code ?? "",
      record.redirectUri
    );

    const now = new Date();
    const expiresAt = exchanged.expiresInSeconds
      ? new Date(now.getTime() + exchanged.expiresInSeconds * 1000)
      : null;

    const exchangedScopes = exchanged.scopes ?? [];
    const isDev = provider.isDevProvider || isDevMarkerScope(exchangedScopes);
    const scopes = isDev ? markDev(exchangedScopes) : exchangedScopes;

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.socialAccount.upsert({
        where: {
          workspaceId_platform_platformAccountId: {
            workspaceId: record.workspaceId,
            platform: record.platform,
            platformAccountId: exchanged.platformAccountId,
          },
        },
        create: {
          workspaceId: record.workspaceId,
          platform: record.platform,
          platformAccountId: exchanged.platformAccountId,
          name: exchanged.name,
          username: exchanged.username,
          avatarUrl: exchanged.avatarUrl,
          status: "CONNECTED",
          scopes,
          lastSyncAt: now,
        },
        update: {
          name: exchanged.name,
          username: exchanged.username,
          avatarUrl: exchanged.avatarUrl,
          status: "CONNECTED",
          scopes,
          lastSyncAt: now,
        },
      });

      await tx.socialAccountToken.upsert({
        where: { socialAccountId: account.id },
        create: {
          socialAccountId: account.id,
          encryptedAccessToken: encryptSecret(exchanged.accessToken),
          encryptedRefreshToken: exchanged.refreshToken
            ? encryptSecret(exchanged.refreshToken)
            : null,
          tokenExpiresAt: expiresAt,
          scopes,
          createdById: context.user.id,
        },
        update: {
          encryptedAccessToken: encryptSecret(exchanged.accessToken),
          encryptedRefreshToken: exchanged.refreshToken
            ? encryptSecret(exchanged.refreshToken)
            : null,
          tokenExpiresAt: expiresAt,
          scopes,
        },
      });

      await tx.oAuthState.update({
        where: { id: record.id },
        data: { consumedAt: now },
      });

      return account;
    });

    await writeAudit({
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      actorId: context.user.id,
      socialAccountId: result.id,
      action: "account.connected",
      entityType: "SocialAccount",
      entityId: result.id,
      metadata: { platform: result.platform, isDev },
      ipAddress: request.headers.get("x-forwarded-for") ?? null,
    });

    return redirectToApp(body.state, isDev ? "connected_dev" : undefined);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown provider error";
    await prisma.oAuthState
      .updateMany({
        where: { state: body.state, consumedAt: null },
        data: { consumedAt: new Date() },
      })
      .catch(() => undefined);
    console.error("[oauth-callback]", detail);
    return redirectToApp(body.state, "provider_error");
  }
}
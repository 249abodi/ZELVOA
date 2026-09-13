import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { callbackQuerySchema } from "@/lib/validators";
import { getProvider } from "@/lib/integrations/factory";
import { encryptSecret } from "@/lib/crypto";
import { markDev, isDevMarkerScope } from "@/lib/integrations/dev-provider";
import { redactError } from "@/lib/integrations/redact";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/service";
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

  let failedUserId: string | null = null;
  let failedWorkspaceId: string | null = null;
  let failedPlatform: string | null = null;

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

    failedUserId = context.user.id;
    failedWorkspaceId = record.workspaceId;
    failedPlatform = record.platform;

    const provider = getProvider(record.platform);
    const exchanged = await provider.exchangeCode(
      body.code ?? "",
      record.redirectUri
    );

    const discoveries =
      typeof provider.getAccounts === "function"
        ? await provider.getAccounts(exchanged)
        : [];

    if (!Array.isArray(discoveries) || discoveries.length === 0) {
      return redirectToApp(body.state, "no_accounts_discovered");
    }

    const now = new Date();
    const exchangedScopes = discoveries[0].scopes ?? exchanged.scopes ?? [];
    const isDev = provider.isDevProvider || isDevMarkerScope(exchangedScopes);
    const scopesToStore = isDev ? markDev(exchangedScopes) : exchangedScopes;

    const result = await prisma.$transaction(async (tx) => {
      const created: Array<{ id: string; platform: string }> = [];
      for (const discovered of discoveries) {
        if (!discovered.platformAccountId || !discovered.token?.accessToken) continue;
        const expiresAt = discovered.token.expiresInSeconds
          ? new Date(now.getTime() + discovered.token.expiresInSeconds * 1000)
          : null;

        const account = await tx.socialAccount.upsert({
          where: {
            workspaceId_platform_platformAccountId: {
              workspaceId: record.workspaceId,
              platform: record.platform,
              platformAccountId: discovered.platformAccountId,
            },
          },
          create: {
            workspaceId: record.workspaceId,
            platform: record.platform,
            platformAccountId: discovered.platformAccountId,
            name: discovered.name,
            username: discovered.username,
            avatarUrl: discovered.avatarUrl,
            status: "CONNECTED",
            scopes: scopesToStore,
            lastSyncAt: now,
          },
          update: {
            name: discovered.name,
            username: discovered.username,
            avatarUrl: discovered.avatarUrl,
            status: "CONNECTED",
            scopes: scopesToStore,
            lastSyncAt: now,
          },
        });

        await tx.socialAccountToken.upsert({
          where: { socialAccountId: account.id },
          create: {
            socialAccountId: account.id,
            encryptedAccessToken: encryptSecret(discovered.token.accessToken),
            encryptedRefreshToken: discovered.token.refreshToken
              ? encryptSecret(discovered.token.refreshToken)
              : null,
            tokenExpiresAt: expiresAt,
            scopes: scopesToStore,
            createdById: context.user.id,
          },
          update: {
            encryptedAccessToken: encryptSecret(discovered.token.accessToken),
            encryptedRefreshToken: discovered.token.refreshToken
              ? encryptSecret(discovered.token.refreshToken)
              : null,
            tokenExpiresAt: expiresAt,
            scopes: scopesToStore,
          },
        });

        created.push({ id: account.id, platform: account.platform });
      }

      if (created.length === 0) {
        throw new Error("OAuth flow completed but no accounts could be stored.");
      }

      await tx.oAuthState.update({
        where: { id: record.id },
        data: { consumedAt: now },
      });

      return created;
    });

    for (const account of result) {
      await writeAudit({
        organizationId: record.organizationId,
        workspaceId: record.workspaceId,
        actorId: context.user.id,
        socialAccountId: account.id,
        action: "account.connected",
        entityType: "SocialAccount",
        entityId: account.id,
        metadata: { platform: account.platform, isDev },
        ipAddress: request.headers.get("x-forwarded-for") ?? null,
      });
      await createNotification({
        workspaceId: record.workspaceId,
        userId: context.user.id,
        type: "ACCOUNT_CONNECTED",
        title: `${account.platform} connected`,
        body: account.platform,
        data: { type: "account", platform: account.platform, socialAccountId: account.id } as never,
      });
    }

    return redirectToApp(body.state, isDev ? "connected_dev" : undefined);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown provider error";
    await prisma.oAuthState
      .updateMany({
        where: { state: body.state, consumedAt: null },
        data: { consumedAt: new Date() },
      })
      .catch(() => undefined);
    console.error("[oauth-callback]", redactError(detail));
    if (failedUserId) {
      await createNotification({
        workspaceId: failedWorkspaceId,
        userId: failedUserId,
        type: "OAUTH_CONNECT_FAILED",
        title: "Account connection failed",
        body: "The platform connection could not be completed. Please try again.",
        data: {
          platform: failedPlatform,
          error: body.error ?? null,
          errorDescription: body.error_description ?? null,
          reason: "provider_error",
        } as never,
      }).catch(() => undefined);
    }
    return redirectToApp(body.state, "provider_error");
  }
}
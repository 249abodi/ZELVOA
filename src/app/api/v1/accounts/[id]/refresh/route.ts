import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, unauthorized, forbidden, notFound, ok } from "@/lib/api";
import { getProvider } from "@/lib/integrations/factory";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { isDevMarkerScope, markDev } from "@/lib/integrations/dev-provider";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let accountId: string | null = null;
  let workspaceId: string | null = null;
  let actorId: string | null = null;
  let platform: string | null = null;
  try {
    const { id } = await params;
    accountId = id;
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "accounts.manage")) {
      return forbidden("You do not have permission to manage social accounts.");
    }
    workspaceId = context.workspace.id;
    actorId = context.user.id;

    const account = await prisma.socialAccount.findFirst({
      where: { id, workspaceId: context.workspace.id },
      include: { token: true },
    });
    if (!account) return notFound("Social account not found.");
    if (!account.token?.encryptedRefreshToken) {
      return fail("This account has no refresh token to renew.", 400);
    }
    platform = account.platform;

    const refreshToken = decryptSecret(account.token.encryptedRefreshToken);
    const provider = getProvider(account.platform);
    const refreshed = await provider.refresh(refreshToken);

    if (!refreshed.accessToken) return fail("Provider returned an empty token.", 502);

    const now = new Date();
    const expiresAt = refreshed.expiresInSeconds
      ? new Date(now.getTime() + refreshed.expiresInSeconds * 1000)
      : null;

    const scopes = isDevMarkerScope(account.scopes)
      ? markDev(account.token.scopes ?? [])
      : (account.token.scopes ?? []);

    await prisma.socialAccountToken.update({
      where: { socialAccountId: id },
      data: {
        encryptedAccessToken: encryptSecret(refreshed.accessToken),
        encryptedRefreshToken: refreshed.refreshToken
          ? encryptSecret(refreshed.refreshToken)
          : account.token.encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        scopes,
      },
    });
    await prisma.socialAccount.update({
      where: { id },
      data: { status: "CONNECTED", lastSyncAt: now },
    });

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      socialAccountId: id,
      action: "account.token_refreshed",
      entityType: "SocialAccount",
      entityId: id,
      metadata: { platform: account.platform },
    });

    return ok({ refreshed: true, expiresAt: expiresAt?.toISOString() ?? null });
  } catch (error) {
    if (accountId && actorId && workspaceId) {
      await createNotification({
        workspaceId,
        userId: actorId,
        type: "TOKEN_EXPIRING",
        title: `${platform ?? "Social account"} token needs attention`,
        body: "Reconnect this account to keep publishing.",
        data: { type: "account", platform, socialAccountId: accountId } as never,
      }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}
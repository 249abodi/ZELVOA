import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, unauthorized, forbidden, notFound, ok } from "@/lib/api";
import { getProvider } from "@/lib/integrations/factory";
import { decryptSecret } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "accounts.manage")) {
      return forbidden("You do not have permission to manage social accounts.");
    }

    const account = await prisma.socialAccount.findFirst({
      where: { id, workspaceId: context.workspace.id },
      include: { token: true },
    });
    if (!account) return notFound("Social account not found.");

    // Best-effort remote revocation; never blocks a disconnect.
    if (account.token?.encryptedAccessToken && !account.scopes.includes("zelvoa:dev")) {
      const provider = getProvider(account.platform);
      try {
        const token = decryptSecret(account.token.encryptedAccessToken);
        await provider.revoke(token);
      } catch {
        // ignore revocation errors — local disconnect must still succeed
      }
    }

    await prisma.$transaction([
      prisma.socialAccount.update({
        where: { id },
        data: { status: "DISCONNECTED", lastSyncAt: null },
      }),
      prisma.socialAccountToken.deleteMany({ where: { socialAccountId: id } }),
    ]);

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      socialAccountId: id,
      action: "account.disconnected",
      entityType: "SocialAccount",
      entityId: id,
      metadata: { platform: account.platform },
    });

    return ok({ disconnected: true });
  } catch (error) {
    return handleApiError(error);
  }
}
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ok, forbidden, handleApiError, fail, unauthorized } from "@/lib/api";
import { parsePendingPayload } from "@/lib/pending-selection";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pendingId: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("pending_unauthorized", 400);
    if (!can(context.role, "accounts.manage")) return forbidden("pending_unauthorized");

    const { pendingId } = await params;
    const pending = await prisma.pendingPageSelection.findUnique({
      where: { id: pendingId },
    });
    if (!pending) return fail("pending_not_found", 404);

    const now = new Date();
    if (pending.expiresAt.getTime() < now.getTime()) {
      await prisma.pendingPageSelection
        .deleteMany({ where: { id: pending.id } })
        .catch(() => undefined);
      return fail("pending_expired", 410);
    }

    if (
      pending.userId !== context.user.id ||
      pending.workspaceId !== context.workspace.id ||
      pending.organizationId !== context.organization?.id
    ) {
      return forbidden("pending_unauthorized");
    }

    let payload;
    try {
      payload = parsePendingPayload(pending.encryptedPayload);
    } catch {
      return fail("pending_expired", 410);
    }

    const pageIds = payload.pages.map((p) => p.pageId);
    const existing = await prisma.socialAccount.findMany({
      where: {
        workspaceId: context.workspace.id,
        platform: pending.platform,
        platformAccountId: { in: pageIds },
      },
      select: { platformAccountId: true },
    });
    const connected = new Set(existing.map((a) => a.platformAccountId));

    return ok({
      pages: payload.pages.map((p) => ({
        pageId: p.pageId,
        name: p.name,
        username: p.username,
        avatarUrl: p.avatarUrl,
        alreadyConnected: connected.has(p.pageId),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
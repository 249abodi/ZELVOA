import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ok, forbidden, handleApiError, fail, unauthorized, parseJson } from "@/lib/api";
import { confirmPageSelectionSchema } from "@/lib/validators";
import { parsePendingPayload, PendingSelectionError } from "@/lib/pending-selection";
import { encryptSecret } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/service";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("pending_unauthorized", 400);
    if (!can(context.role, "accounts.manage")) {
      return forbidden("You do not have permission to manage social accounts.");
    }

    const workspace = context.workspace;

    const raw = await parseJson(request);
    const body = confirmPageSelectionSchema.parse(raw);
    const selectedIds = Array.from(new Set(body.selectedPageIds));
    const now = new Date();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const pending = await tx.pendingPageSelection.delete({
          where: { id: body.pendingId },
        });

        if (pending.expiresAt.getTime() < now.getTime()) {
          throw new PendingSelectionError("pending_expired");
        }
        if (
          pending.userId !== context.user.id ||
          pending.workspaceId !== workspace.id ||
          pending.organizationId !== context.organization?.id
        ) {
          throw new PendingSelectionError("pending_unauthorized");
        }

        let payload;
        try {
          payload = parsePendingPayload(pending.encryptedPayload);
        } catch {
          throw new PendingSelectionError("pending_expired");
        }

        const known = new Map(payload.pages.map((p) => [p.pageId, p]));
        const unknown = selectedIds.filter((id) => !known.has(id));
        if (unknown.length > 0) {
          throw new PendingSelectionError("pending_invalid_selection");
        }

        const created: Array<{ id: string; platform: string }> = [];
        for (const id of selectedIds) {
          const stored = known.get(id)!;
          const account = await tx.socialAccount.upsert({
            where: {
              workspaceId_platform_platformAccountId: {
                workspaceId: pending.workspaceId,
                platform: pending.platform,
                platformAccountId: id,
              },
            },
            create: {
              workspaceId: pending.workspaceId,
              platform: pending.platform,
              platformAccountId: id,
              name: stored.name,
              username: stored.username,
              avatarUrl: stored.avatarUrl,
              status: "CONNECTED",
              scopes: payload.scopes,
              lastSyncAt: now,
            },
            update: {
              name: stored.name,
              username: stored.username,
              avatarUrl: stored.avatarUrl,
              status: "CONNECTED",
              scopes: payload.scopes,
              lastSyncAt: now,
            },
          });

          await tx.socialAccountToken.upsert({
            where: { socialAccountId: account.id },
            create: {
              socialAccountId: account.id,
              encryptedAccessToken: encryptSecret(stored.accessToken),
              encryptedRefreshToken: null,
              tokenExpiresAt: null,
              scopes: payload.scopes,
              createdById: context.user.id,
            },
            update: {
              encryptedAccessToken: encryptSecret(stored.accessToken),
              encryptedRefreshToken: null,
              tokenExpiresAt: null,
              scopes: payload.scopes,
            },
          });

          created.push({ id: account.id, platform: account.platform });
        }

        return { pending, created, isDev: payload.isDev };
      });

      for (const account of result.created) {
        await writeAudit({
          organizationId: result.pending.organizationId,
          workspaceId: result.pending.workspaceId,
          actorId: context.user.id,
          socialAccountId: account.id,
          action: "account.connected",
          entityType: "SocialAccount",
          entityId: account.id,
          metadata: { platform: account.platform, isDev: result.isDev },
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        });
        await createNotification({
          workspaceId: result.pending.workspaceId,
          userId: context.user.id,
          type: "ACCOUNT_CONNECTED",
          title: `${account.platform} connected`,
          body: account.platform,
          data: { type: "account", platform: account.platform, socialAccountId: account.id } as never,
        });
      }

      return ok({ connected: true, accounts: result.created.length });
    } catch (error) {
      if (error instanceof PendingSelectionError) {
        return pendingSelectionResponse(error.code);
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return ok({ connected: false, alreadyCompleted: true });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function pendingSelectionResponse(
  code: "pending_expired" | "pending_unauthorized" | "pending_invalid_selection"
) {
  if (code === "pending_unauthorized") return forbidden(code);
  if (code === "pending_invalid_selection") return fail(code, 422);
  return fail(code, 410);
}
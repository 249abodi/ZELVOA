import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail } from "@/lib/api";
import { syncInbox } from "@/lib/inbox/sync";
import { writeAudit } from "@/lib/audit";

export async function POST() {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "inbox.view")) {
      return fail("You do not have permission to sync the inbox.", 403);
    }

    const summary = await syncInbox(context.workspace.id);

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "inbox.synced",
      entityType: "Inbox",
      entityId: context.workspace.id,
      metadata: {
        fetchedConversations: summary.fetchedConversations,
        fetchedMessages: summary.fetchedMessages,
        unsupported: summary.unsupported.length,
        devMode: summary.devMode,
      },
    });

    return ok(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
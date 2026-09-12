import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail } from "@/lib/api";
import { analyticsSyncSchema } from "@/lib/validators";
import { syncAnalytics } from "@/lib/analytics/sync";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "analytics.view")) {
      return fail("You do not have permission to sync analytics.", 403);
    }

    let from = new Date();
    from.setDate(from.getDate() - 30);
    let to = new Date();
    const raw = await request.json().catch(() => null);
    if (raw && typeof raw === "object") {
      const parsed = analyticsSyncSchema.parse(raw);
      if (parsed.from) from = new Date(parsed.from);
      if (parsed.to) to = new Date(parsed.to);
    }

    const result = await syncAnalytics(context.workspace.id, from, to);

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "analytics.synced",
      entityType: "Analytics",
      entityId: context.workspace.id,
      metadata: {
        created: result.created,
        skipped: result.skipped,
        unsupported: result.unsupported.length,
        devMode: result.devMode,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ok, forbidden, handleApiError, fail, unauthorized, parseJson } from "@/lib/api";
import { cancelPendingSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("pending_unauthorized", 400);
    if (!can(context.role, "accounts.manage")) {
      return forbidden("You do not have permission to manage social accounts.");
    }

    const raw = await parseJson(request);
    const body = cancelPendingSchema.parse(raw);

    const deleted = await prisma.pendingPageSelection.deleteMany({
      where: {
        id: body.pendingId,
        userId: context.user.id,
        workspaceId: context.workspace.id,
        organizationId: context.organization?.id ?? "",
      },
    });
    if (deleted.count === 0) return fail("pending_not_found", 404);

    return ok({ cancelled: true });
  } catch (error) {
    return handleApiError(error);
  }
}
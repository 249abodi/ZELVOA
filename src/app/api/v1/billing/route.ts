import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail } from "@/lib/api";
import { getBillingInfo } from "@/lib/billing/limits";

export async function GET() {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.organization) return fail("No organization selected.", 400);
    if (!can(context.role, "billing.manage") && !can(context.role, "org.view")) {
      return fail("You do not have permission to view billing.", 403);
    }

    const info = await getBillingInfo(context.organization.id);
    return ok(info);
  } catch (error) {
    return handleApiError(error);
  }
}
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail } from "@/lib/api";
import { isAIEnabled, getAIProvider, aiConfigHint } from "@/lib/ai/factory";
import { getOrganizationMonthlyAICount, monthlyRequestLimit } from "@/lib/ai/usage";

export async function GET() {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!can(context.role, "ai.use")) {
      return fail("You do not have permission to use the AI assistant.", 403);
    }

    const provider = getAIProvider();
    const enabled = isAIEnabled();
    const orgId = context.organization?.id;
    const monthly = orgId ? await getOrganizationMonthlyAICount(orgId) : 0;

    return ok({
      enabled,
      message: enabled
        ? "AI provider connected."
        : aiConfigHint(),
      code: enabled ? null : "AI_NOT_CONFIGURED",
      model: provider?.model ?? null,
      monthlyUsage: monthly,
      monthlyLimit: monthlyRequestLimit(),
      remaining: Math.max(0, monthlyRequestLimit() - monthly),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

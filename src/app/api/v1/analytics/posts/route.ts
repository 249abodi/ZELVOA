import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail } from "@/lib/api";
import { analyticsQuerySchema } from "@/lib/validators";
import { getTopPosts } from "@/lib/analytics/query";

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "analytics.view")) {
      return fail("You do not have permission to view analytics.", 403);
    }

    const { searchParams } = new URL(request.url);
    const parsed = analyticsQuerySchema.parse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      platform: searchParams.get("platform") ?? undefined,
    });

    const from = new Date(parsed.from);
    const to = new Date(parsed.to);

    const posts = await getTopPosts({
      workspaceId: context.workspace.id,
      from,
      to,
      platform: parsed.platform,
      limit: 15,
    });

    return ok({ posts });
  } catch (error) {
    return handleApiError(error);
  }
}
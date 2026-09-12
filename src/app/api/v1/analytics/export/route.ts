import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { fail, unauthorized } from "@/lib/api";
import { analyticsQuerySchema } from "@/lib/validators";
import { getTimeSeries } from "@/lib/analytics/query";
import { buildAnalyticsCsv } from "@/lib/analytics/csv";

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
    const series = await getTimeSeries({
      workspaceId: context.workspace.id,
      from,
      to,
      platform: parsed.platform,
    });

    const csv = buildAnalyticsCsv(series);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zelvoa-analytics-${parsed.from}-to-${parsed.to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return fail("Could not export analytics.", 500);
  }
}
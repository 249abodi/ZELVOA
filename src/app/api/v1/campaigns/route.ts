import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ok, created, fail, unauthorized, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { campaignCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "campaign.manage") && !can(context.role, "analytics.view")) {
      return fail("You do not have permission to view campaigns.", 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const where: Record<string, unknown> = {
      workspaceId: context.workspace.id,
      deletedAt: null,
    };
    if (status && ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"].includes(status)) {
      where.status = status;
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        goal: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
        _count: { select: { posts: true, analytics: true } },
      },
    });

    return ok({
      campaigns: campaigns.map((c) => ({
        ...c,
        postCount: c._count.posts,
        snapshotCount: c._count.analytics,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "campaign.manage")) {
      return fail("You do not have permission to create campaigns.", 403);
    }

    const body = await request.json();
    const parsed = campaignCreateSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: context.workspace.id,
        name: parsed.name,
        description: parsed.description,
        goal: parsed.goal,
        startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
        endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
        status: parsed.status ?? "DRAFT",
        createdById: context.user?.id,
      },
      select: { id: true, name: true, status: true, createdAt: true },
    });

    return created(campaign);
  } catch (error) {
    return handleApiError(error);
  }
}
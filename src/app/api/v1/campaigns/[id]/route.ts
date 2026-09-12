import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ok, fail, unauthorized, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { campaignUpdateSchema, campaignPostSchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "campaign.manage") && !can(context.role, "analytics.view")) {
      return fail("You do not have permission to view this campaign.", 403);
    }
    const { id } = await params;

    const campaign = await prisma.campaign.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        goal: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
        posts: {
          select: {
            id: true,
            postId: true,
            createdAt: true,
            post: {
              select: {
                id: true,
                title: true,
                content: true,
                status: true,
                publishedAt: true,
                socialAccount: { select: { id: true, name: true, platform: true } },
              },
            },
          },
        },
        _count: { select: { analytics: true } },
      },
    });

    if (!campaign) return fail("Campaign not found.", 404);
    return ok(campaign);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "campaign.manage")) {
      return fail("You do not have permission to update campaigns.", 403);
    }
    const { id } = await params;

    const body = await request.json();
    const parsed = campaignUpdateSchema.parse(body);

    const existing = await prisma.campaign.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return fail("Campaign not found.", 404);

    const data: Record<string, unknown> = {};
    if (parsed.name !== undefined) data.name = parsed.name;
    if (parsed.description !== undefined) data.description = parsed.description;
    if (parsed.goal !== undefined) data.goal = parsed.goal;
    if (parsed.startDate !== undefined) data.startDate = parsed.startDate ? new Date(parsed.startDate) : null;
    if (parsed.endDate !== undefined) data.endDate = parsed.endDate ? new Date(parsed.endDate) : null;
    if (parsed.status !== undefined) data.status = parsed.status;

    const updated = await prisma.campaign.update({
      where: { id },
      data,
      select: { id: true, name: true, status: true, updatedAt: true },
    });

    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "campaign.manage")) {
      return fail("You do not have permission to delete campaigns.", 403);
    }
    const { id } = await params;

    const existing = await prisma.campaign.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return fail("Campaign not found.", 404);

    await prisma.campaign.update({ where: { id }, data: { deletedAt: new Date() } });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "campaign.manage")) {
      return fail("You do not have permission to add posts to campaigns.", 403);
    }
    const { id } = await params;

    const campaign = await prisma.campaign.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
      select: { id: true },
    });
    if (!campaign) return fail("Campaign not found.", 404);

    const body = await request.json();
    const parsed = campaignPostSchema.parse(body);

    const post = await prisma.post.findFirst({
      where: { id: parsed.postId, workspaceId: context.workspace.id, deletedAt: null },
      select: { id: true },
    });
    if (!post) return fail("Post not found.", 404);

    const existing = await prisma.campaignPost.findFirst({
      where: { campaignId: id, postId: parsed.postId },
      select: { id: true },
    });
    if (existing) return fail("Post is already linked to this campaign.", 409);

    const link = await prisma.campaignPost.create({
      data: {
        campaignId: id,
        postId: parsed.postId,
        socialAccountId: parsed.socialAccountId,
      },
      select: { id: true, createdAt: true },
    });

    return ok(link);
  } catch (error) {
    return handleApiError(error);
  }
}
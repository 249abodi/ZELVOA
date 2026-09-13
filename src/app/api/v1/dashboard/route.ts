import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ok, unauthorized, fail } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const context = await getCurrentContext();
  if (!context) return unauthorized();
  if (!can(context.role, "post.view")) return fail("You do not have permission to view the dashboard.", 403);

  const workspaceId = context.workspace?.id;
  if (!workspaceId) {
    return ok({
      workspace: null,
      summary: null,
      upcomingPosts: [],
      recentActivity: [],
    });
  }

  const now = new Date();

  const [postCount, publishedCount, scheduledCount, draftCount, socialAccounts, upcomingPosts, recentActivity] =
    await Promise.all([
      prisma.post.count({ where: { workspaceId, deletedAt: null } }),
      prisma.post.count({ where: { workspaceId, status: "PUBLISHED", deletedAt: null } }),
      prisma.post.count({ where: { workspaceId, status: "SCHEDULED", deletedAt: null } }),
      prisma.post.count({ where: { workspaceId, status: "DRAFT", deletedAt: null } }),
      prisma.socialAccount.findMany({
        where: { workspaceId, status: "CONNECTED" },
        select: { id: true, platform: true, name: true },
      }),
      prisma.scheduledPost.findMany({
        where: {
          workspaceId,
          scheduledFor: { gte: now },
          status: { in: ["PENDING", "QUEUED"] },
        },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              content: true,
              postType: true,
              status: true,
            },
          },
          socialAccount: { select: { platform: true } },
        },
        orderBy: { scheduledFor: "asc" },
        take: 10,
      }),
      prisma.post.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          createdBy: { select: { name: true } },
        },
        take: 5,
      }),
    ]);

  const upcoming = upcomingPosts.map((p) => ({
    id: p.id,
    scheduledFor: p.scheduledFor,
    platform: p.socialAccount?.platform ?? p.post.status,
    title: p.post.title ?? p.post.content.slice(0, 60),
    postType: p.post.postType,
    status: p.post.status,
    content: p.post.content,
  }));

  return ok({
    workspace: { id: workspaceId },
    summary: {
      posts: postCount,
      published: publishedCount,
      scheduled: scheduledCount,
      drafts: draftCount,
      socialAccounts: socialAccounts.length,
    },
    upcomingPosts: upcoming,
    recentActivity,
    hasSocialAccounts: socialAccounts.length > 0,
  });
}
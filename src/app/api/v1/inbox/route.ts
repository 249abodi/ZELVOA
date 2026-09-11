import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail } from "@/lib/api";
import { inboxListQuerySchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "inbox.view")) {
      return fail("You do not have permission to view the inbox.", 403);
    }

    const { searchParams } = new URL(request.url);
    const query = inboxListQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
      assignee: searchParams.get("assignee") ?? undefined,
      query: searchParams.get("query") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    const workspaceId = context.workspace.id;

    const where: Prisma.ConversationWhereInput = {
      workspaceId,
    };
    if (query.status) where.status = query.status;
    if (query.assignee === "me") where.assigneeId = context.user.id;
    if (query.assignee === "unassigned") where.assigneeId = null;

    const limit = query.limit;
    const cursorCond = query.cursor
      ? {
          AND: [
            { updatedAt: { lt: new Date(query.cursor) } },
          ],
        }
      : undefined;

    if (cursorCond) {
      where.AND = [...(where.AND && Array.isArray(where.AND) ? where.AND : []), cursorCond];
    }

    if (query.query) {
      const needle = query.query;
      where.OR = [{ contactName: { contains: needle, mode: "insensitive" } }, { contactUsername: { contains: needle, mode: "insensitive" } }];
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: limit + 1,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        socialAccount: { select: { id: true, name: true, platform: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true },
        },
        _count: {
          select: {
            messages: {
              where: { direction: "INBOUND", readAt: null },
            },
          },
        },
      },
    });

    const hasMore = conversations.length > limit;
    const items = hasMore ? conversations.slice(0, limit) : conversations;

    return ok({
      conversations: items.map((c) => ({
        id: c.id,
        platform: c.platform,
        contactName: c.contactName,
        contactUsername: c.contactUsername,
        contactAvatarUrl: c.contactAvatarUrl,
        status: c.status,
        priority: c.priority,
        tags: c.tags,
        unread: c._count.messages,
        lastMessage: c.messages[0]?.content ?? null,
        lastMessageAt: c.lastMessageAt ?? c.updatedAt,
        assignee: c.assignee
          ? { id: c.assignee.id, name: c.assignee.name, email: c.assignee.email }
          : null,
        account: c.socialAccount
          ? { id: c.socialAccount.id, name: c.socialAccount.name, platform: c.socialAccount.platform }
          : null,
      })),
      nextCursor: hasMore ? new Date(items[items.length - 1].updatedAt).toISOString() : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
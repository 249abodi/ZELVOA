import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { inboxUpdateSchema } from "@/lib/validators";
import { hasDevScope } from "@/lib/inbox/source";
import type { Prisma } from "@prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "inbox.view")) {
      return fail("You do not have permission to view conversations.", 403);
    }

    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, workspaceId: context.workspace.id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        socialAccount: {
          select: { id: true, name: true, platform: true, scopes: true },
        },
        messages: {
          orderBy: { sentAt: "asc" },
          select: {
            id: true,
            direction: true,
            content: true,
            sentAt: true,
            readAt: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!conversation) return notFound("Conversation not found.");

    return ok({
      id: conversation.id,
      platform: conversation.platform,
      contactName: conversation.contactName,
      contactUsername: conversation.contactUsername,
      contactAvatarUrl: conversation.contactAvatarUrl,
      status: conversation.status,
      priority: conversation.priority,
      tags: conversation.tags,
      notes: conversation.notes,
      devMode: hasDevScope(conversation.socialAccount?.scopes ?? []),
      assignee: conversation.assignee,
      account: conversation.socialAccount
        ? {
            id: conversation.socialAccount.id,
            name: conversation.socialAccount.name,
            platform: conversation.socialAccount.platform,
          }
        : null,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        sentAt: m.sentAt,
        read: m.readAt !== null,
        sender: m.sender,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "inbox.reply")) {
      return fail("You do not have permission to update conversations.", 403);
    }

    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, workspaceId: context.workspace.id },
      select: { id: true, status: true },
    });
    if (!conversation) return notFound("Conversation not found.");

    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object") return fail("Invalid body.", 400);

    const body = inboxUpdateSchema.parse(raw);
    if ("assigneeId" in body && !can(context.role, "inbox.assign")) {
      return fail("You do not have permission to assign conversations.", 403);
    }

    const data: Prisma.ConversationUpdateInput = {};
    if (body.status) data.status = body.status;
    if (body.priority) data.priority = body.priority;
    if (body.tags) data.tags = body.tags;
    if ("notes" in body) data.notes = body.notes;
    if ("assigneeId" in body) {
      if (body.assigneeId) {
        const target = await prisma.organizationMember.findFirst({
          where: {
            organizationId: context.organization?.id,
            userId: body.assigneeId,
          },
          select: { userId: true },
        });
        if (!target) return fail("Assignee is not a member of this organization.", 400);
        data.assignee = { connect: { id: body.assigneeId } };
      } else {
        data.assignee = { disconnect: true };
      }
      if (!body.status) data.status = body.assigneeId ? "ASSIGNED" : conversation.status || "OPEN";
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return ok({
      id: updated.id,
      status: updated.status,
      priority: updated.priority,
      tags: updated.tags,
      notes: updated.notes,
      assignee: updated.assignee ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
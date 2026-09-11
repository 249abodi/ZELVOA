import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { inboxReplySchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { hasDevScope } from "@/lib/inbox/source";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "inbox.reply")) {
      return fail("You do not have permission to reply in the inbox.", 403);
    }

    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, workspaceId: context.workspace.id },
      include: {
        socialAccount: { select: { id: true, scopes: true } },
      },
    });
    if (!conversation) return notFound("Conversation not found.");

    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object") return fail("Invalid body.", 400);
    const body = inboxReplySchema.parse(raw);

    const devOnly =
      hasDevScope(conversation.socialAccount?.scopes ?? []) &&
      process.env.NODE_ENV !== "production";

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: context.user.id,
        direction: "OUTBOUND",
        content: body.content,
        readAt: new Date(),
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.sentAt,
        status: "OPEN",
      },
    });

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "inbox.replied",
      entityType: "Conversation",
      entityId: conversation.id,
      metadata: {
        platform: conversation.platform,
        devOnly,
      },
    });

    return ok({
      id: message.id,
      direction: message.direction,
      content: message.content,
      sentAt: message.sentAt,
      sender: message.sender,
      devOnly,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
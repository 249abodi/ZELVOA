import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ok, fail, unauthorized, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { approvalActionSchema } from "@/lib/validators";
import { resolveApprovalTransition } from "@/lib/approvals/state";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);

    const { id } = await params;
    const approval = await prisma.approval.findFirst({
      where: { id, workspaceId: context.workspace.id },
      select: {
        id: true,
        status: true,
        requestedAt: true,
        resolvedAt: true,
        post: {
          select: {
            id: true,
            title: true,
            content: true,
            status: true,
            scheduledFor: true,
            socialAccount: { select: { id: true, name: true, platform: true } },
          },
        },
        requester: { select: { id: true, name: true, email: true } },
        actions: {
          orderBy: { createdAt: "asc" },
          select: {
            action: true,
            comment: true,
            createdAt: true,
            actor: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!approval) return fail("Approval not found.", 404);
    return ok(approval);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.approve")) {
      return fail("You do not have permission to act on approvals.", 403);
    }

    const { id } = await params;
    const approval = await prisma.approval.findFirst({
      where: { id, workspaceId: context.workspace.id },
      select: { id: true, status: true, postId: true },
    });
    if (!approval) return fail("Approval not found.", 404);
    if (approval.status !== "PENDING") {
      return fail("This approval has already been resolved.", 409);
    }

    const body = await request.json();
    const parsed = approvalActionSchema.parse(body);
    const transition = resolveApprovalTransition(parsed.action);

    await prisma.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id },
        data: { status: transition.approvalStatus, resolvedAt: new Date() },
      });

      await tx.post.update({
        where: { id: approval.postId },
        data: { status: transition.postStatus },
      });

      await tx.approvalAction.create({
        data: {
          approvalId: id,
          actorId: context.user!.id,
          action: parsed.action,
          comment: parsed.comment,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspace!.id,
          actorId: context.user!.id,
          action: `approval.${parsed.action.toLowerCase()}`,
          entityType: "Approval",
          entityId: id,
          metadata: { postId: approval.postId },
        },
      });
    });

    return ok({ id, status: transition.approvalStatus, postStatus: transition.postStatus });
  } catch (error) {
    return handleApiError(error);
  }
}
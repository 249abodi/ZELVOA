import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ok, fail, unauthorized, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { approvalSubmitSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const where: Record<string, unknown> = {
      workspaceId: context.workspace.id,
    };
    if (status && ["PENDING", "APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const approvals = await prisma.approval.findMany({
      where,
      orderBy: { requestedAt: "desc" },
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
            socialAccount: { select: { name: true, platform: true } },
          },
        },
        requester: {
          select: { id: true, name: true, email: true },
        },
        actions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            action: true,
            comment: true,
            createdAt: true,
            actor: { select: { name: true } },
          },
        },
      },
    });

    return ok({ approvals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "post.edit")) {
      return fail("You do not have permission to submit posts for approval.", 403);
    }

    const body = await request.json();
    const parsed = approvalSubmitSchema.parse(body);

    const post = await prisma.post.findFirst({
      where: { id: parsed.postId, workspaceId: context.workspace.id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!post) return fail("Post not found.", 404);

    const pending = await prisma.approval.findFirst({
      where: { postId: parsed.postId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) return fail("This post already has a pending approval request.", 409);

    const approval = await prisma.$transaction(async (tx) => {
      const a = await tx.approval.create({
        data: {
          workspaceId: context.workspace!.id,
          postId: parsed.postId,
          requestedById: context.user!.id,
          status: "PENDING",
        },
        select: { id: true, status: true, requestedAt: true },
      });

      await tx.post.update({
        where: { id: parsed.postId },
        data: { status: "PENDING_APPROVAL" },
      });

      await tx.approvalAction.create({
        data: {
          approvalId: a.id,
          actorId: context.user!.id,
          action: "SUBMIT",
          comment: parsed.comment,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspace!.id,
          actorId: context.user!.id,
          action: "approval.submitted",
          entityType: "Approval",
          entityId: a.id,
          metadata: { postId: parsed.postId },
        },
      });

      return a;
    });

    return ok(approval);
  } catch (error) {
    return handleApiError(error);
  }
}
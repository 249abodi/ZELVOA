import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, unauthorized, forbidden, notFound, ok, parseJson } from "@/lib/api";
import { updateAccountSchema } from "@/lib/validators";
import { serializeAccount } from "@/lib/integrations/serializer";
import { writeAudit } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "accounts.view")) {
      return forbidden("You do not have permission to view social accounts.");
    }

    const account = await prisma.socialAccount.findFirst({
      where: { id, workspaceId: context.workspace.id },
      include: { token: true },
    });
    if (!account) return notFound("Social account not found.");

    const summary = serializeAccount(account, account.token);
    const tokenRecord = account.token;
    const canRefresh = Boolean(tokenRecord?.encryptedRefreshToken);
    const scopes = (tokenRecord?.scopes ?? []).filter((s) => s !== "zelvoa:dev");

    return ok({ ...summary, canRefresh, tokenScopes: scopes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "accounts.manage")) {
      return forbidden("You do not have permission to manage social accounts.");
    }

    const raw = await parseJson(request);
    const body = updateAccountSchema.parse(raw);

    const exists = await prisma.socialAccount.findFirst({
      where: { id, workspaceId: context.workspace.id },
      select: { id: true },
    });
    if (!exists) return notFound("Social account not found.");

    const updated = await prisma.socialAccount.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.username !== undefined && { username: body.username }),
      },
      include: { token: true },
    });

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      socialAccountId: id,
      action: "account.updated",
      entityType: "SocialAccount",
      entityId: id,
      metadata: { fields: ["name", "username"].filter((f) => body[f as keyof typeof body] !== undefined) },
    });

    return ok(serializeAccount(updated, updated.token));
  } catch (error) {
    return handleApiError(error);
  }
}
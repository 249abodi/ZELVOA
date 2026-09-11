import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, unauthorized, ok, forbidden } from "@/lib/api";
import { serializeAccount } from "@/lib/integrations/serializer";

export async function GET() {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "accounts.view")) {
      return forbidden("You do not have permission to view social accounts.");
    }

    const accounts = await prisma.socialAccount.findMany({
      where: { workspaceId: context.workspace.id },
      orderBy: { createdAt: "desc" },
      include: { token: true },
    });

    return ok(accounts.map((a) => serializeAccount(a, a.token)));
  } catch (error) {
    return handleApiError(error);
  }
}
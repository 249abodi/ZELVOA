import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, unauthorized } from "@/lib/api";

export async function GET() {
  const context = await getCurrentContext();
  if (!context) return unauthorized();

  const organizations = await prisma.organizationMember.findMany({
    where: {
      userId: context.user.id,
      status: { not: "REMOVED" },
    },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          workspaces: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok({ organizations });
}
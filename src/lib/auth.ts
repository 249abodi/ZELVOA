import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "zelvoa_session";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export interface CurrentContext {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  } | null;
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  } | null;
  role: string | null;
}

export async function getCurrentContext(): Promise<CurrentContext | null> {
  const session = await getSession();
  if (!session?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });
  if (!user) return null;

  let organization: CurrentContext["organization"] = null;
  let workspace: CurrentContext["workspace"] = null;
  let role: string | null = session.role ?? null;

  const member = session.org
    ? await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: session.org,
            userId: user.id,
          },
        },
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true, timezone: true } },
          organizationId: true,
        },
      })
    : null;

  if (member) {
    organization = member.organization;
    role = member.role;
    if (session.ws) {
      const ws = await prisma.workspace.findUnique({
        where: { id: session.ws },
        select: { id: true, name: true, slug: true, timezone: true },
      });
      if (ws) workspace = ws;
    }
  }

  return { user, organization, workspace, role };
}

export function requireAuth(context: CurrentContext | null): context is CurrentContext {
  return context !== null;
}
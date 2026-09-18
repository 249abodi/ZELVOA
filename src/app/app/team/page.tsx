import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, can } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InviteMemberButton } from "@/components/team/invite-member-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const context = await getCurrentContext();
  if (!context) redirect("/login");

  const organizationId = context.organization?.id;
  const members = organizationId
    ? await prisma.organizationMember.findMany({
        where: { organizationId, status: { not: "REMOVED" } },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      })
    : [];

  const canInvite = can(context.role, "member.invite");

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      OWNER: "bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300",
      ADMIN: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/40 dark:text-secondary-300",
      CONTENT_MANAGER: "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300",
      DESIGNER: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
      SOCIAL_MEDIA_MANAGER: "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300",
      VIEWER: "bg-muted text-muted-foreground",
    };
    return styles[role] ?? styles.VIEWER;
  };

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage members and roles in this workspace."
        icon="team"
        actions={canInvite ? <InviteMemberButton /> : <Badge variant="secondary">Read-only</Badge>}
      />

      <Card className="mb-6">
        <CardContent className="p-0">
          {members.length === 0 ? (
            <EmptyState
              icon="team"
              title="No members yet"
              description="Invite teammates to collaborate on content, approvals, and publishing."
            />
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={m.user.name} src={m.user.avatarUrl} />
                    <div>
                      <p className="text-sm font-medium">
                        {m.user.name}
                        {m.user.id === context.user.id && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status === "INVITED" && (
                      <Badge variant="warning" dot>
                        Invited
                      </Badge>
                    )}
                    <Badge variant="outline" className={roleBadge(m.role)}>
                      {ROLES.find((r) => r.value === m.role)?.label ?? m.role}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Roles & permissions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <Card key={r.value}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{r.label}</CardTitle>
                  {r.value === context.role && (
                    <Badge variant="default">Your role</Badge>
                  )}
                </div>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Permissions are enforced by the backend. Role definitions live in{" "}
          <code className="rounded bg-muted px-1 py-0.5">src/lib/rbac.ts</code>.
        </p>
      </section>
    </div>
  );
}
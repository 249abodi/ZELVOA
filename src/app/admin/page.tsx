import { getCurrentContext } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

function StatTile({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon: "users" | "grid" | "workspace" | "accounts" | "create" | "shield";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon name={icon} size={16} className="text-muted-foreground/60" />
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{count.toLocaleString()}</div>
    </div>
  );
}

export default async function AdminPage() {
  const context = await getCurrentContext();
  if (!context) redirect("/login");
  if (!canAccessAdmin({ email: context.user?.email, role: context.role })) {
    redirect("/app/dashboard");
  }

  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const [orgs, workspaces, users, accounts, posts, auditCount] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.workspace.count({ where: { deletedAt: null } }),
    prisma.user.count(),
    prisma.socialAccount.count(),
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.auditLog.count(),
  ]);

  const recentLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      action: true,
      entityType: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Platform-wide health and usage.</p>
        </div>
        <Badge variant={database ? "success" : "destructive"}>
          {database ? "Database connected" : "Database down"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Organizations" count={orgs} icon="grid" />
        <StatTile label="Workspaces" count={workspaces} icon="workspace" />
        <StatTile label="Users" count={users} icon="users" />
        <StatTile label="Social accounts" count={accounts} icon="accounts" />
        <StatTile label="Posts" count={posts} icon="create" />
        <StatTile label="Audit events" count={auditCount} icon="shield" />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <Link href="/admin/audit" className="text-sm font-medium text-primary hover:underline">
            View all →
          </Link>
        </div>
        {recentLogs.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">No audit events yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-4 px-6 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{log.action}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {log.entityType}
                    {log.actor ? ` · ${log.actor.name ?? log.actor.email}` : ""}
                  </div>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {log.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
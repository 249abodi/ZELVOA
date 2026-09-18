import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";

export const metadata = { title: "Audit Log" };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; entityType?: string }>;
}) {
  const context = await getCurrentContext();
  if (!context) redirect("/login");
  if (!canAccessAdmin({ email: context.user?.email, role: context.role })) {
    redirect("/app/dashboard");
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const action = sp.action || undefined;
  const entityType = sp.entityType || undefined;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
        workspace: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable record of actions across the platform.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Workspace</th>
                <th className="px-6 py-3 font-medium text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/60 last:border-0">
                  <td className="px-6 py-3">
                    <Badge variant="secondary">{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {log.actor ? log.actor.name ?? log.actor.email : "system"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="font-medium text-foreground">{log.entityType}</span>
                    {log.entityId ? (
                      <span className="ml-1 font-mono text-xs opacity-70">
                        {log.entityId.slice(0, 8)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{log.workspace?.name ?? "—"}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground">
                    {log.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                    No audit events match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages} · {total.toLocaleString()} events
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={`/admin/audit?page=${page - 1}`}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
            >
              <Icon name="chevron-left" size={14} />
              Previous
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground">
              <Icon name="chevron-left" size={14} />
              Previous
            </span>
          )}
          {page < totalPages ? (
            <Link
              href={`/admin/audit?page=${page + 1}`}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
            >
              Next
              <Icon name="chevron-right" size={14} />
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground">
              Next
              <Icon name="chevron-right" size={14} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
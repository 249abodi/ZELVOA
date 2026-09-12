import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: "dashboard" as const },
  { href: "/admin/audit", label: "Audit log", icon: "shield" as const },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentContext();
  if (!context) redirect("/login");
  if (!canAccessAdmin({ email: context.user?.email, role: context.role })) {
    redirect("/app/dashboard");
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-card lg:block">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icon name="shield" size={16} />
            </div>
            <div>
              <div className="text-sm font-semibold">ZELVOA Admin</div>
              <div className="text-xs text-muted-foreground">Platform console</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <Link
              href="/app/dashboard"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icon name="logout" size={16} />
              Back to app
            </Link>
          </div>
        </div>
      </aside>
      <div className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
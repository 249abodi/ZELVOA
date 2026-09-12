"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { ZelvoaLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

export const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: "dashboard" },
  { label: "Content Calendar", href: "/app/calendar", icon: "calendar" },
  { label: "Create Post", href: "/app/posts/create", icon: "create" },
  { label: "AI Assistant", href: "/app/ai", icon: "sparkles" },
  { label: "Media Library", href: "/app/media", icon: "media" },
  { label: "Inbox", href: "/app/inbox", icon: "inbox" },
  { label: "Analytics", href: "/app/analytics", icon: "analytics" },
  { label: "Campaigns", href: "/app/campaigns", icon: "campaigns" },
];

export const managementNav: NavItem[] = [
  { label: "Team", href: "/app/team", icon: "team" },
  { label: "Approvals", href: "/app/approvals", icon: "approvals" },
  { label: "Social Accounts", href: "/app/accounts", icon: "accounts" },
  { label: "Billing", href: "/app/billing", icon: "billing" },
  { label: "Settings", href: "/app/settings", icon: "settings" },
];

export const adminNav: NavItem[] = [
  { label: "Admin Console", href: "/admin", icon: "shield" },
];

export function Sidebar({
  organizationName,
  role,
}: {
  organizationName: string;
  role: string | null;
}) {
  const pathname = usePathname();
  const active = pathname.startsWith("/app") ? pathname : "/app/dashboard";
  const isActive = (href: string) =>
    href === "/app/dashboard"
      ? active === href
      : active === href || active.startsWith(`${href}`);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <Link href="/app/dashboard" className="flex items-center gap-2.5">
          <ZelvoaLogo variant="full" size={30} />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <SidebarSection
          title="Manage"
          items={mainNav}
          isActive={isActive}
        />
        <SidebarSection
          title="Workspace"
          items={managementNav}
          isActive={isActive}
        />
        {role === "OWNER" && (
          <SidebarSection title="Platform" items={adminNav} isActive={isActive} />
        )}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-background-subtle p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300">
            <Icon name="workspace" size={16} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{organizationName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {role?.replaceAll("_", " ").toLowerCase()}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({
  title,
  items,
  isActive,
}: {
  title: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
}) {
  return (
    <div>
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <ul className="grid gap-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon
                name={item.icon}
                size={18}
                className={isActive(item.href) ? "text-primary" : ""}
              />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
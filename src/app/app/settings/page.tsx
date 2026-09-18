import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { SettingsSection } from "@/components/settings/section";
import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { SecuritySettings } from "@/components/settings/security-settings";
import { Icon, type IconName } from "@/components/icons";

export const metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

const tabs = [
  { id: "workspace", label: "Workspace", icon: "workspace" as IconName },
  { id: "account", label: "Account", icon: "user" as IconName },
  { id: "notifications", label: "Notifications", icon: "bell" as IconName },
  { id: "security", label: "Security", icon: "shield" as IconName },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = tabs.some((t) => t.id === tab) ? tab! : "workspace";

  const context = await getCurrentContext();
  if (!context) redirect("/login");

  const [userSettings, workspaceSettings] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: context.user.id } }),
    context.workspace?.id
      ? prisma.workspaceSettings.findUnique({
          where: { workspaceId: context.workspace.id },
        })
      : null,
  ]);

  const canManageWorkspace = can(context.role, "workspace.manage");

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your workspace, account, and preferences."
        icon="settings"
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Tab list */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 lg:w-56 lg:flex-col">
          {tabs.map((t) => (
            <a
              key={t.id}
              href={`/app/settings?tab=${t.id}`}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active === t.id
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </a>
          ))}
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {active === "workspace" && (
            <SettingsSection
              title="Workspace"
              description="Workspace name, timezone, and default language."
            >
              <WorkspaceForm
                initialName={context.workspace?.name ?? context.organization?.name ?? ""}
                initialTimezone={context.workspace?.timezone ?? context.organization?.timezone ?? "UTC"}
                canManage={canManageWorkspace}
              />
            </SettingsSection>
          )}

          {active === "account" && (
            <SettingsSection
              title="Account"
              description="Your profile and personal preferences."
            >
              <ProfileForm
                initialName={context.user.name}
                initialEmail={context.user.email}
                initialTimezone={context.workspace?.timezone ?? "UTC"}
              />
            </SettingsSection>
          )}

          {active === "notifications" && (
            <SettingsSection
              title="Notifications"
              description="Choose which notifications you receive."
            >
              <NotificationPreferences
                initialEmailNotifications={userSettings?.emailNotifications ?? true}
                initialInAppNotifications={userSettings?.inAppNotifications ?? true}
                initialMarketingEmails={userSettings?.marketingEmails ?? false}
              />
            </SettingsSection>
          )}

          {active === "security" && (
            <SettingsSection
              title="Security"
              description="Sessions, password, and account security."
            >
              <div className="grid max-w-md gap-4">
                <div className="flex items-center justify-between rounded-xl border border-border bg-background-subtle px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-muted-foreground">
                      Password change is managed through secure sessions.
                    </p>
                  </div>
                  <Icon name="lock" size={18} className="text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-background-subtle px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Active sessions</p>
                    <p className="text-xs text-muted-foreground">
                      Sessions are signed with JWT and expire automatically.
                    </p>
                  </div>
                  <Icon name="shield" size={18} className="text-muted-foreground" />
                </div>
                {workspaceSettings ? (
                  <SecuritySettings
                    approvalRequired={workspaceSettings.approvalRequired}
                  />
                ) : null}
              </div>
            </SettingsSection>
          )}
        </div>
      </div>
    </div>
  );
}
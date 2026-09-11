import { Icon, type IconName } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  title,
  description,
  icon,
  badge,
  actions,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/30">
            <Icon name={icon} size={22} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {badge && <Badge variant="secondary">{badge}</Badge>}
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PhasePlaceholder({
  phase,
  title,
  description,
  icon = "database",
  plannedFeatures,
}: {
  phase: string;
  title: string;
  description: string;
  icon?: IconName;
  plannedFeatures: string[];
}) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        badge="Coming soon"
      />
      <div className="grid gap-6">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/30">
            <Icon name={icon} size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">{title} is in development</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This feature is part of <span className="font-medium">{phase}</span>.
              The UI below shows what is being built — nothing is faked, and
              nothing publishes to real platforms until integrations are
              available.
            </p>
          </div>
          <Badge variant="warning">In development</Badge>
        </div>

        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-sm font-semibold">Planned capabilities</h3>
          </div>
          <ul className="grid gap-1 p-4 sm:grid-cols-2">
            {plannedFeatures.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground"
              >
                <Icon name="check" size={15} className="text-muted-foreground/50" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
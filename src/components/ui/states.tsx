import { Icon, type IconName } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon = "inbox",
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  actionIcon,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  actionIcon?: IconName;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-background-subtle px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon name={icon} size={26} />
      </div>
      <div className="grid gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} icon={actionIcon} className="mt-1">
          {actionLabel}
        </Button>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref} className={cn(buttonVariants({ variant: "default" }), "mt-1")}>
          {actionIcon && <Icon name={actionIcon} size={16} />}
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-background-subtle px-6 py-16">
      <Icon name="spinner" size={24} className="animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <Icon name="alert-circle" size={26} />
      </div>
      <div className="grid gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} icon="refresh" className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}

export function PagePlaceholder({
  title,
  description,
  icon = "database",
}: {
  title: string;
  description: string;
  icon?: IconName;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-background-subtle px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon name={icon} size={26} />
      </div>
      <div className="grid gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
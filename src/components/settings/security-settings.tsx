"use client";

import { Switch } from "@/components/ui/switch";

export function SecuritySettings({ approvalRequired }: { approvalRequired: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background-subtle px-4 py-3">
      <div>
        <p className="text-sm font-medium">Approval required</p>
        <p className="text-xs text-muted-foreground">
          Require manager approval before publishing.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={approvalRequired} disabled onCheckedChange={() => {}} aria-label="Approval required" />
        <span className="text-xs text-muted-foreground">Coming soon</span>
      </div>
    </div>
  );
}
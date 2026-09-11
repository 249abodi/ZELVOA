"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { Icon } from "@/components/icons";

export function WorkspaceForm({
  initialName,
  initialTimezone,
  canManage,
}: {
  initialName: string;
  initialTimezone?: string;
  canManage: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone ?? "UTC");
  const [saving, setSaving] = useState(false);
  const { toastSuccess, toastError } = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message);
      toastSuccess("Workspace updated");
    } catch (err) {
      toastError("Could not update workspace", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background-subtle px-4 py-3 text-sm text-muted-foreground">
        <Icon name="lock" size={15} />
        You need workspace management permission to change these settings.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="ws-name">Workspace name</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ws-tz">Workspace timezone</Label>
        <select
          id="ws-tz"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="flex h-10 w-full appearance-none rounded-lg border border-input bg-card px-3 py-2 pr-9 text-sm shadow-xs"
        >
          {["UTC", "America/New_York", "Europe/London", "Asia/Kuala_Lumpur", "Asia/Riyadh", "Asia/Dubai", "Africa/Cairo"].map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
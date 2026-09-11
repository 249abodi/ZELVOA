"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";

export function ProfileForm({
  initialName,
  initialEmail,
  initialTimezone,
}: {
  initialName: string;
  initialEmail: string;
  initialTimezone?: string;
}) {
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone ?? "UTC");
  const [saving, setSaving] = useState(false);
  const { toastSuccess, toastError } = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message);
      toastSuccess("Profile updated");
    } catch (err) {
      toastError("Could not update profile", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="settings-name">Full name</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="settings-email">Email</Label>
        <Input id="settings-email" value={initialEmail} disabled />
        <p className="text-xs text-muted-foreground">
          Email is used for sign-in and notifications.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="settings-tz">Timezone</Label>
        <select
          id="settings-tz"
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
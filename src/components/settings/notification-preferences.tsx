"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";

interface NotificationPreferencesProps {
  initialEmailNotifications: boolean;
  initialInAppNotifications: boolean;
  initialMarketingEmails: boolean;
}

export function NotificationPreferences({
  initialEmailNotifications,
  initialInAppNotifications,
  initialMarketingEmails,
}: NotificationPreferencesProps) {
  const { toastSuccess, toastError } = useToast();
  const [email, setEmail] = useState(initialEmailNotifications);
  const [inApp, setInApp] = useState(initialInAppNotifications);
  const [marketing, setMarketing] = useState(initialMarketingEmails);

  async function update(field: string, value: boolean) {
    const prev = { email, inApp, marketing };
    const next = { ...prev, [field]: value } as {
      email: boolean;
      inApp: boolean;
      marketing: boolean;
    };
    const body = {
      emailNotifications: next.email,
      inAppNotifications: next.inApp,
      marketingEmails: next.marketing,
    };
    try {
      const res = await fetch("/api/v1/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message);
      if (field === "email") setEmail(value);
      if (field === "inApp") setInApp(value);
      if (field === "marketing") setMarketing(value);
      toastSuccess("Notification preferences saved");
    } catch (err) {
      toastError("Could not update preferences", getErrorMessage(err));
    }
  }

  return (
    <div className="grid max-w-md gap-4">
      <NotificationRow
        title="Email notifications"
        description="Product updates and digests by email."
        checked={email}
        onChange={(v) => update("email", v)}
      />
      <NotificationRow
        title="In-app notifications"
        description="Approvals, publish events, and reminders."
        checked={inApp}
        onChange={(v) => update("inApp", v)}
      />
      <NotificationRow
        title="Marketing emails"
        description="Tips and offers from ZELVOA."
        checked={marketing}
        onChange={(v) => update("marketing", v)}
      />
    </div>
  );
}

function NotificationRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background-subtle px-4 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
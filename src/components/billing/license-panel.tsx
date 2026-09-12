"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/select";

interface LicenseInfo {
  key: string;
  planSlug: string;
  seats: number;
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED" | "REVOKED";
  expiresAt: string | null;
}

const TOKEN_PATTERN = /^ZELVOA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export default function LicensePanel({
  license,
  canManage,
}: {
  license: LicenseInfo | null;
  canManage: boolean;
}) {
  const { toastSuccess, toastError } = useToast();
  const [key, setKey] = useState("");
  const [planSlug, setPlanSlug] = useState("starter");
  const [activating, setActivating] = useState(false);

  const activate = async () => {
    if (!TOKEN_PATTERN.test(key.trim().toUpperCase())) {
      toastError("Invalid key format. Expected: ZELVOA-XXXX-XXXX-XXXX");
      return;
    }
    setActivating(true);
    try {
      const res = await fetch("/api/v1/billing/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), planSlug }),
      });
      const json = await res.json();
      if (!res.ok) {
        toastError(json?.error?.message ?? "Could not activate license.");
        return;
      }
      toastSuccess("License activated.");
      setKey("");
      window.location.reload();
    } catch {
      toastError("Could not activate license.");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">White-label license</h3>
        <Icon name="shield" size={18} className="text-muted-foreground/60" />
      </div>

      {license ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <div>
            <div className="font-mono text-sm font-medium tracking-wider">{license.key}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Plan <span className="font-medium text-foreground">{license.planSlug}</span> ·{" "}
              {license.seats} seat{license.seats === 1 ? "" : "s"}
              {license.expiresAt ? ` · expires ${license.expiresAt.slice(0, 10)}` : ""}
            </div>
          </div>
          <Badge variant={license.status === "ACTIVE" ? "success" : "warning"}>
            {license.status.toLowerCase()}
          </Badge>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No license key activated for this organization.
        </p>
      )}

      {canManage && (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="license-key">License key</Label>
            <Input
              id="license-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="ZELVOA-XXXX-XXXX-XXXX"
              className="font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="license-plan">Plan</Label>
            <Select
              id="license-plan"
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value)}
              options={[
                { value: "starter", label: "Starter" },
                { value: "business", label: "Business" },
                { value: "agency", label: "Agency" },
              ]}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={activate} disabled={activating}>
              {activating ? "Activating…" : "Activate"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            License keys are provisioned by ZELVOA. Activation does not charge a card.
          </p>
        </div>
      )}
    </div>
  );
}
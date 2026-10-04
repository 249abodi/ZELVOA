"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export interface AccountSummary {
  id: string;
  platform: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  status: string;
  lastSyncAt: string | null;
  scopes: string[];
  createdAt: string;
  isDev: boolean;
  token: {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt: string | null;
    expired: boolean;
    expiresSoon: boolean;
  } | null;
}

export function AccountDetailModal({
  account,
  open,
  onClose,
  onChange,
}: {
  account: AccountSummary | null;
  open: boolean;
  onClose: () => void;
  onChange: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [busy, setBusy] = useState<"refresh" | "disconnect" | "reconnect" | null>(null);
  const [detail, setDetail] = useState<AccountSummary & { canRefresh?: boolean; tokenScopes?: string[] } | null>(null);

  useEffect(() => {
    if (!open || !account) return;
    let cancelled = false;
    fetch(`/api/v1/accounts/${account.id}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load_failed"))))
      .then((data: { data: AccountSummary & { canRefresh?: boolean; tokenScopes?: string[] } }) => {
        if (!cancelled) setDetail(data.data);
      })
      .catch(() => {
        if (!cancelled) setDetail(account);
      });
    return () => {
      cancelled = true;
    };
  }, [open, account]);

  const action = async (kind: "refresh" | "disconnect" | "reconnect") => {
    if (!account) return;
    setBusy(kind);
    try {
      if (kind === "disconnect") {
        if (!window.confirm("Disconnect this account? Its stored token will be revoked and removed.")) {
          return;
        }
      }
      const res = await fetch(`/api/v1/accounts/${account.id}/${kind === "reconnect" ? "reconnect" : kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "reconnect" ? JSON.stringify({}) : undefined,
      });
      const data = (await res.json().catch(() => null)) as {
        data?: { authorizationUrl?: string; refreshed?: boolean; disconnected?: boolean; status?: string; message?: string };
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        toastError("Action failed", data?.error?.message ?? "Could not complete the action.");
        return;
      }
      if (kind === "refresh") {
        toastSuccess("Token refreshed", "The access token was renewed.");
      } else if (kind === "disconnect") {
        toastSuccess("Account disconnected");
        onClose();
        onChange();
        return;
      } else if (data?.data?.authorizationUrl) {
        window.location.assign(data.data.authorizationUrl);
        return;
      }
      onChange();
    } catch {
      toastError("Action failed", "Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  if (!account) return null;

  const scopes = detail?.tokenScopes ?? account.scopes.filter((s) => s !== "zelvoa:dev");

  return (
    <Modal open={open} onClose={onClose} title={account.name} description={`${account.platform} · ${account.username ?? "no handle"}`} size="md">
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <PlatformBadge platform={account.platform} />
          {account.isDev && <Badge variant="warning" dot>Development mode</Badge>}
          <Badge variant={account.status === "CONNECTED" ? "success" : "warning"} dot>
            {account.status === "CONNECTED" ? "Connected" : account.status.toLowerCase()}
          </Badge>
        </div>

        <div className="grid gap-2 rounded-xl border border-border bg-background-subtle p-4 text-sm">
          <Row label="Account ID" value={account.id} />
          <Row label="Last sync" value={formatDate(account.lastSyncAt)} />
          <Row label="Created" value={formatDate(account.createdAt)} />
          <Row label="Scopes" value={scopes.length ? scopes.join(", ") : "—"} />
        </div>

        {detail?.token && (
          <div className="grid gap-2 rounded-xl border border-border bg-background-subtle p-4 text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Token status
            </div>
            <Row
              label="Access token"
              value={detail.token.hasAccessToken ? "Stored (encrypted)" : "None"}
            />
            <Row
              label="Refresh token"
              value={detail.token.hasRefreshToken ? "Stored (encrypted)" : "None"}
            />
            <Row
              label="Expires"
              value={
                detail.token.expiresAt
                  ? `${formatDate(detail.token.expiresAt)}${detail.token.expired ? " (expired)" : detail.token.expiresSoon ? " (expires soon)" : ""}`
                  : "Never"
              }
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={busy === "refresh" ? "spinner" : "refresh"}
            disabled={busy !== null || !detail?.canRefresh}
            loading={busy === "refresh"}
            onClick={() => action("refresh")}
          >
            Refresh token
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon="link"
            disabled={busy !== null}
            loading={busy === "reconnect"}
            onClick={() => action("reconnect")}
          >
            Reconnect
          </Button>
          {account.isDev ? (
            <Button
              variant="destructive"
              size="sm"
              icon="trash"
              disabled={busy !== null}
              loading={busy === "disconnect"}
              onClick={() => action("disconnect")}
            >
              Remove
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              icon="trash"
              disabled={busy !== null}
              loading={busy === "disconnect"}
              onClick={() => action("disconnect")}
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-all text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, { icon: IconName; cls: string }> = {
    INSTAGRAM: {
      icon: "instagram",
      cls: "bg-accent-100 text-accent-600 dark:bg-accent-600/30 dark:text-accent-300",
    },
    FACEBOOK: {
      icon: "facebook",
      cls: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300",
    },
    TIKTOK: {
      icon: "tiktok",
      cls: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
    },
    LINKEDIN: {
      icon: "linkedin",
      cls: "bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300",
    },
    X: {
      icon: "xtwitter",
      cls: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
    },
    YOUTUBE: {
      icon: "youtube",
      cls: "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive",
    },
  };
  const meta = map[platform] ?? map.INSTAGRAM;
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.cls}`}>
      <Icon name={meta.icon} size={18} />
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

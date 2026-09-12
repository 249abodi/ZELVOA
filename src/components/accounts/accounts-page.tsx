"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { ConnectAccountModal } from "@/components/accounts/connect-modal";
import { AccountDetailModal, type AccountSummary } from "@/components/accounts/account-detail-modal";
import { useToast } from "@/components/ui/toast";
import { PLATFORM_META } from "@/lib/integrations/platforms";
import type { Platform } from "@/lib/integrations/types";

interface Notify {
  kind: "connected" | "error";
  message?: string;
}

export function AccountsPageClient({
  canManage,
  notify,
  isProduction,
  devProvidersAllowed,
}: {
  canManage: boolean;
  notify: Notify | null;
  isProduction: boolean;
  devProvidersAllowed: boolean;
}) {
  const { toastSuccess, toastError, toastInfo } = useToast();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [selected, setSelected] = useState<AccountSummary | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const requestKeyRef = useRef(0);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/v1/accounts");
    if (!res.ok) throw new Error("failed");
    const data = (await res.json()) as { data: AccountSummary[] };
    return data.data;
  }, []);

  const refetch = useCallback(async () => {
    const key = ++requestKeyRef.current;
    setError(false);
    try {
      const data = await loadAccounts();
      if (requestKeyRef.current !== key) return;
      setAccounts(data);
    } catch {
      setError(true);
    }
  }, [loadAccounts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      setError(false);
      try {
        const data = await loadAccounts();
        if (cancelled) return;
        setAccounts(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAccounts]);

  useEffect(() => {
    if (!notify) return;
    if (notify.kind === "connected") {
      if (notify.message === "connected_dev") {
        toastInfo("Connected", "Development-mode account added.");
      } else {
        toastSuccess("Account connected");
      }
      void Promise.resolve().then(refetch);
    } else if (notify.kind === "error") {
      toastError("Connection failed", decodeURIComponent(notify.message ?? "Unknown error"));
    }
  }, [notify, refetch, toastSuccess, toastError, toastInfo]);

  const devAccounts = accounts.filter((a) => a.isDev);
  const expiringAccounts = accounts.filter(
    (a) => a.status === "CONNECTED" && a.token?.expiresSoon && !a.token.expired
  );
  const expiredAccounts = accounts.filter(
    (a) => a.status === "CONNECTED" && a.token?.expired
  );

  const openDetails = (account: AccountSummary) => {
    setSelected(account);
    setDetailOpen(true);
  };

  return (
    <div className="grid gap-6">
      {!isProduction &&
        (devProvidersAllowed ? (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            Development providers are enabled. Connecting a platform without real credentials
            will create clearly-labelled development accounts.
          </p>
        ) : (
          <p className="rounded-lg bg-background-subtle px-3 py-2 text-xs text-muted-foreground">
            No provider credentials are configured and development providers are disabled.
            Platforms will show as unavailable until credentials are added.
          </p>
        ))}

      {(devAccounts.length > 0 || expiredAccounts.length > 0 || expiringAccounts.length > 0) && (
        <div className="grid gap-2">
          {devAccounts.length > 0 && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              {devAccounts.length} development-mode account{devAccounts.length > 1 ? "s" : ""} connected.
              These were created through the development provider and are not real platform accounts.
            </p>
          )}
          {expiredAccounts.length > 0 && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {expiredAccounts.length} account token{expiredAccounts.length > 1 ? "s have" : " has"} expired.
              Reconnect to keep publishing.
            </p>
          )}
          {expiringAccounts.length > 0 && (
            <p className="rounded-lg bg-background-subtle px-3 py-2 text-xs text-muted-foreground">
              {expiringAccounts.length} token{expiringAccounts.length > 1 ? "s are" : " is"} expiring soon.
              Refresh or reconnect when convenient.
            </p>
          )}
        </div>
      )}

      {!loaded ? (
        <LoadingState label="Loading accounts…" />
      ) : error ? (
        <ErrorState
          title="Failed to load accounts"
          description="Something went wrong while loading your social accounts."
          onRetry={() => {
            setLoaded(false);
            refetch().then(() => setLoaded(true)).catch(() => setLoaded(true));
          }}
        />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon="accounts"
          title="No accounts connected"
          description="Connect a platform to start publishing and scheduling content through ZELVOA."
          actionLabel={canManage ? "Connect Account" : undefined}
          onAction={canManage ? () => setConnectOpen(true) : undefined}
          actionIcon="plus"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onOpen={() => openDetails(a)}
            />
          ))}
        </div>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button icon="plus" onClick={() => setConnectOpen(true)}>
            Connect Account
          </Button>
        </div>
      )}

      <ConnectAccountModal
        key={connectOpen ? "open" : "closed"}
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
      />
      <AccountDetailModal
        account={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onChange={() => refetch()}
      />
    </div>
  );
}

function AccountCard({
  account,
  onOpen,
}: {
  account: AccountSummary;
  onOpen: () => void;
}) {
  const meta = PLATFORM_META[account.platform as Platform] ?? PLATFORM_META.INSTAGRAM;
  const publishingBlocked = !meta.publishingImplemented && !account.isDev;
  const statusLabel =
    account.status === "CONNECTED"
      ? account.token?.expired
        ? "Token expired"
        : account.token?.expiresSoon
          ? "Expiring soon"
          : "Connected"
      : account.status.toLowerCase();

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.iconClass}`}>
        <Icon name={meta.icon} size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{account.name}</p>
          {account.isDev && (
            <Badge variant="warning">Dev</Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {account.username ?? meta.label}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge
            variant={
              account.token?.expired
                ? "destructive"
                : account.status === "CONNECTED"
                  ? "success"
                  : "warning"
            }
            dot
          >
            {statusLabel}
          </Badge>
          {publishingBlocked && (
            <Badge variant="secondary">Publishing in development</Badge>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <Button variant="ghost" size="icon-sm" onClick={onOpen} aria-label="Account details" icon="chevron-right" />
      </div>
    </div>
  );
}
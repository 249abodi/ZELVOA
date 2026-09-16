"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

interface StatusProvider {
  platform: string;
  configured: boolean;
  devMode: boolean;
  reason: string;
  label: string;
  icon: IconName;
  capabilities: string[];
  publishingImplemented: boolean;
}

interface StatusResponse {
  devProvidersAllowed: boolean;
  isProduction: boolean;
  providers: StatusProvider[];
}

export function ConnectAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [providers, setProviders] = useState<StatusProvider[]>([]);
  const [statusError, setStatusError] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusError(false);
    try {
      const res = await fetch("/api/v1/accounts/status");
      if (!res.ok) throw new Error("status_failed");
      const data = (await res.json()) as { data: StatusResponse };
      setProviders(data.data.providers);
    } catch {
      setStatusError(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setStatusError(false);
      try {
        const res = await fetch("/api/v1/accounts/status");
        if (!res.ok) throw new Error("status_failed");
        const data = (await res.json()) as { data: StatusResponse };
        if (!cancelled) setProviders(data.data.providers);
      } catch {
        if (!cancelled) setStatusError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const provider = providers.find((p) => p.platform === selected) ?? null;
  const canConnect = provider?.configured || provider?.devMode;

  const handleConnect = async () => {
    if (!selected) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/v1/accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: selected }),
      });
      const data = (await res.json()) as {
        data?: {
          status: string;
          canConnect: boolean;
          authorizationUrl?: string;
          state?: string;
          isDev?: boolean;
          message?: string;
        };
        error?: { message?: string };
      };
      if (!res.ok || !data.data?.canConnect) {
        setConnectError(data.error?.message ?? data.data?.message ?? "Cannot start connection.");
        return;
      }
      if (data.data.authorizationUrl) {
        window.location.assign(data.data.authorizationUrl);
        return;
      }
    } catch {
      setConnectError("Could not start the connection. Check your network and try again.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect a social account"
      description="ZELVOA uses secure OAuth2. Tokens are encrypted at rest and never stored as plaintext."
      size="lg"
    >
      {statusError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Icon name="alert-circle" size={24} className="text-destructive" />
          <p className="text-sm text-muted-foreground">
            Could not load provider availability.
          </p>
          <Button
            variant="outline"
            onClick={() => loadStatus()}
          >
            Retry
          </Button>
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Icon name="spinner" size={24} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading providers…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((p) => (
              <button
                key={p.platform}
                type="button"
                onClick={() => setSelected(p.platform)}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  selected === p.platform
                    ? "border-primary bg-primary-50 dark:bg-primary-900/20"
                    : p.configured
                      ? "border-border hover:border-border-strong hover:bg-muted"
                      : "border-dashed border-border-strong opacity-80 hover:opacity-100"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon name={p.icon} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.capabilities.join(", ") || "No capabilities"}
                  </p>
                </div>
                {p.configured ? (
                  <Badge variant="success" dot>
                    Ready
                  </Badge>
                ) : p.devMode ? (
                  <Badge variant="warning" dot>
                    Dev
                  </Badge>
                ) : (
                  <Badge variant="secondary">Unavailable</Badge>
                )}
              </button>
            ))}
          </div>

          {provider && (
            <div className="mt-5 rounded-xl border border-border bg-background-subtle p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{provider.label}</p>
                {provider.configured ? (
                  <Badge variant="success" dot>
                    OAuth ready
                  </Badge>
                ) : provider.devMode ? (
                  <Badge variant="warning" dot>
                    Development mode
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not configured</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{provider.reason}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant={provider.publishingImplemented ? "success" : "secondary"}
                  dot={provider.publishingImplemented}
                >
                  {provider.publishingImplemented
                    ? "Publishing ready"
                    : "Publishing in development"}
                </Badge>
                {!provider.publishingImplemented && !provider.devMode && (
                  <span className="text-xs text-muted-foreground">
                    Publishing to this platform is not available yet.
                  </span>
                )}
              </div>

              {provider.devMode && !connectError && (
                <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  Connecting through the development provider creates a clearly-labelled
                  development account used for building and testing workflows. It does not
                  contact any real platform.
                </p>
              )}
              {!provider.devMode && (
                <p className="mt-3 rounded-lg bg-background-subtle px-3 py-2 text-xs text-muted-foreground">
                  After connecting you can refresh tokens and revoke access at any time from
                  the account details panel.
                </p>
              )}

              {connectError && (
                <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {connectError}
                </p>
              )}

              <Button
                className="mt-4 w-full"
                onClick={handleConnect}
                disabled={!canConnect || connecting}
                loading={connecting}
                icon={canConnect ? "external" : "lock"}
              >
                {provider.configured
                  ? `Connect ${provider.label}`
                  : provider.devMode
                    ? `Connect ${provider.label} (Development)`
                    : "Not available — see above"}
              </Button>
              {!canConnect && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Add the platform credentials in your environment to enable this integration.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
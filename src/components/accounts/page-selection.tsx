"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Icon } from "@/components/icons";
import { getPendingErrorMessage } from "@/lib/integrations/oauth-messages";
import {
  allSelectableSelected,
  selectAllPages,
  selectablePageIds,
  togglePageSelection,
} from "@/lib/pending-selection";

export interface SelectablePage {
  pageId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  alreadyConnected: boolean;
}

interface PendingResponse {
  data?: { pages: SelectablePage[] };
  error?: { message?: string };
}

type SelectionView =
  | { kind: "loading" }
  | { kind: "ready"; pages: SelectablePage[] }
  | { kind: "error"; title: string; message: string; retry: boolean };

export function PageSelection({ pendingId }: { pendingId: string }) {
  const router = useRouter();
  const [view, setView] = useState<SelectionView>({ kind: "loading" });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const goToAccounts = useCallback(
    (params?: { connected?: boolean }) => {
      router.push(params?.connected ? "/app/accounts?connected=true" : "/app/accounts");
      router.refresh();
    },
    [router]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/accounts/pending/${encodeURIComponent(pendingId)}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as PendingResponse | null;
        const code = json?.error?.message ?? "pending_not_found";
        const { title, message } = getPendingErrorMessage(code);
        setView({ kind: "error", title, message, retry: false });
        return;
      }
      const json = (await res.json()) as { data: { pages: SelectablePage[] } };
      setView({ kind: "ready", pages: json.data.pages });
      setSelected(new Set());
    } catch {
      setView({
        kind: "error",
        title: "Failed to load Pages",
        message: "Check your connection and try again.",
        retry: true,
      });
    }
  }, [pendingId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch("/api/v1/accounts/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId, selectedPageIds: Array.from(selected) }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { connected?: boolean; alreadyCompleted?: boolean };
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        const { title, message } = getPendingErrorMessage(json?.error?.message ?? "pending_confirm_failed");
        setView({ kind: "error", title, message, retry: false });
        return;
      }
      if (json?.data?.alreadyCompleted) {
        goToAccounts();
      } else {
        goToAccounts({ connected: true });
      }
    } catch {
      setView({
        kind: "error",
        title: "Connection failed",
        message: "The Pages could not be connected. Check your connection and try again.",
        retry: true,
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await fetch("/api/v1/accounts/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId }),
      });
    } catch {
      setView({
        kind: "error",
        title: "Could not cancel",
        message: "This selection will expire on its own. Return to your accounts.",
        retry: false,
      });
      setCancelling(false);
      return;
    }
    goToAccounts();
  };

  if (view.kind === "loading") {
    return <LoadingState label="Loading your Pages…" />;
  }

  if (view.kind === "error") {
    return (
      <EmptyState
        icon="alert-circle"
        title={view.title}
        description={view.message}
        actionLabel={view.retry ? "Try again" : "Back to accounts"}
        onAction={() => {
          if (view.retry) {
            setView({ kind: "loading" });
            void load();
          } else {
            goToAccounts();
          }
        }}
        actionIcon={view.retry ? "refresh" : "x"}
      />
    );
  }

  const pages = view.pages;
  if (pages.length === 0) {
    return (
      <EmptyState
        icon="accounts"
        title="No Pages available"
        description="The Facebook account did not list any Pages you can manage. You can connect another account instead."
        actionLabel="Back to accounts"
        onAction={() => goToAccounts()}
      />
    );
  }

  const selectionCount = selected.size;
  const allSelected = allSelectableSelected(selected, pages);
  const selectableIds = selectablePageIds(pages);
  const hasSelectable = selectableIds.length > 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {selectionCount} of {hasSelectable ? selectableIds.length : 0} available Page
          {selectionCount === 1 ? "" : "s"} selected
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(selectAllPages(pages))}
            disabled={!hasSelectable || allSelected}
            icon="check"
            aria-label="Select all available Pages"
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
            disabled={selectionCount === 0}
            icon="x"
            aria-label="Clear selection"
          >
            Clear All
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {pages.map((page) => {
          const checked = selected.has(page.pageId);
          const disabled = page.alreadyConnected;
          return (
            <div
              key={page.pageId}
              className={`flex items-start gap-3 rounded-xl border bg-card p-4 ${
                disabled ? "border-border opacity-70" : "border-border"
              }`}
            >
              <Checkbox
                id={`page-${page.pageId}`}
                aria-label={page.name}
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => setSelected((prev) => togglePageSelection(prev, page.pageId))}
              />
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                {page.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="accounts" size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{page.name}</p>
                {page.username && (
                  <p className="truncate text-xs text-muted-foreground">@{page.username}</p>
                )}
                {disabled ? (
                  <span className="mt-1.5 inline-flex">
                    <Badge variant="success" dot>
                      Already connected
                    </Badge>
                  </span>
                ) : (
                  <span className="mt-1.5 inline-flex">
                    <Badge variant="secondary">Available</Badge>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col-reverse items-stretch gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={() => {
            void handleCancel();
          }}
          disabled={cancelling || confirming}
          loading={cancelling}
          icon="x"
        >
          Cancel
        </Button>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            onClick={() => {
              void handleConfirm();
            }}
            disabled={selectionCount === 0 || confirming || cancelling}
            loading={confirming}
            icon="plus"
          >
            Connect Selected
          </Button>
          {selectionCount === 0 && (
            <p className="text-xs text-muted-foreground">
              Select at least one Page to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
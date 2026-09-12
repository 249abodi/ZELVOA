"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/icons";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  workspace: { id: string; name: string } | null;
}

const TYPE_META: Record<string, { icon: IconName; cls: string }> = {
  ACCOUNT_CONNECTED: { icon: "check", cls: "text-success" },
  ACCOUNT_DISCONNECTED: { icon: "x", cls: "text-muted-foreground" },
  TOKEN_EXPIRING: { icon: "alert", cls: "text-warning" },
  POST_SCHEDULED: { icon: "calendar-dot", cls: "text-secondary-600 dark:text-secondary-400" },
  POST_PUBLISHED: { icon: "zap", cls: "text-success" },
  POST_FAILED: { icon: "alert-circle", cls: "text-destructive" },
};

export function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void (async () => {
        try {
          const res = await fetch("/api/v1/notifications?limit=12");
          if (!res.ok || cancelled) return;
          const data = (await res.json()) as {
            data: { notifications: Notification[]; unread: number };
          };
          if (cancelled) return;
          setItems(data.data.notifications);
          setUnread(data.data.unread);
        } catch {
          // ignore — keep the last known state
        } finally {
          if (!cancelled) setLoaded(true);
        }
      })();
    };
    run();
    const timer = setInterval(run, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const markAllRead = async () => {
    if (unread === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setUnread(0);
        setItems((prev) =>
          prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dropdown
      width="w-80"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
          className="relative text-muted-foreground"
        >
          <Icon name="bell" size={18} />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      }
    >
      <DropdownLabel>
        {loaded ? (items.length > 0 ? `${items.length} recent` : "Notifications") : "Loading…"}
      </DropdownLabel>

      {!loaded ? (
        <div className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground">
          <Icon name="spinner" size={14} className="animate-spin" />
          Fetching notifications…
        </div>
      ) : items.length === 0 ? (
        <div className="px-2.5 py-6 text-center text-sm text-muted-foreground">
          You&apos;re all caught up.
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {items.map((n) => {
            const meta = TYPE_META[n.type] ?? { icon: "bell" as IconName, cls: "text-muted-foreground" };
            const unreadItem = n.readAt === null;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg px-2.5 py-2",
                  unreadItem ? "bg-background-subtle" : "opacity-70"
                )}
              >
                <Icon
                  name={meta.icon}
                  size={15}
                  className={cn("mt-0.5 shrink-0", meta.cls)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  {n.body && (
                    <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatTime(n.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <DropdownSeparator />
      <DropdownItem
        icon="check"
        label="Mark all as read"
        onClick={markAllRead}
        disabled={unread === 0 || busy}
      />
    </Dropdown>
  );
}

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}
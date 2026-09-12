"use client";

import { Icon, type IconName } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_META } from "@/lib/integrations/platforms";
import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/integrations/types";

export interface PostAccount {
  id: string;
  platform: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  status: string;
  isDev: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  X: "X",
};

const PLATFORM_ICONS: Record<string, IconName> = {
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  TIKTOK: "tiktok",
  LINKEDIN: "linkedin",
  X: "xtwitter",
};

export function PlatformSelector({
  accounts,
  selected,
  onChange,
}: {
  accounts: PostAccount[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center">
        <Icon name="accounts" size={22} className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Connect a social account to publish.{" "}
          <a href="/app/accounts" className="text-primary-600 underline underline-offset-2 dark:text-primary-400">
            Connect now
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Post to</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {accounts.map((account) => {
          const isSelected = selected.includes(account.id);
          const meta = PLATFORM_META[account.platform as Platform] ?? PLATFORM_META.INSTAGRAM;
          const publishingBlocked = !meta.publishingImplemented && !account.isDev;
          return (
            <button
              key={account.id}
              type="button"
              disabled={publishingBlocked}
              onClick={() => toggle(account.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "border-primary bg-primary-50 dark:bg-primary-900/20"
                  : "border-border hover:border-border-strong hover:bg-muted"
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon name={PLATFORM_ICONS[account.platform]} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{account.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {PLATFORM_LABELS[account.platform]}
                  {account.username ? ` \u00b7 @${account.username}` : ""}
                </p>
              </div>
              {publishingBlocked ? (
                <Badge variant="secondary">Publishing in development</Badge>
              ) : (
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-white"
                      : "border-border-strong"
                  )}
                >
                  {isSelected && <Icon name="check" size={12} strokeWidth={3} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {accounts.some(
        (a) =>
          !(PLATFORM_META[a.platform as Platform] ?? PLATFORM_META.INSTAGRAM)
            .publishingImplemented && !a.isDev
      ) && (
        <p className="text-xs text-muted-foreground">
          Accounts marked “Publishing in development” cannot be selected yet. Their provider
          adapter is not implemented.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {selected.slice(0, 3).map((id) => {
          const account = accounts.find((a) => a.id === id);
          if (!account) return null;
          return (
            <Badge key={id} variant="outline">
              <Icon name={PLATFORM_ICONS[account.platform]} size={11} />
              {PLATFORM_LABELS[account.platform]}
            </Badge>
          );
        })}
        {selected.length > 3 && (
          <Badge variant="outline">+{selected.length - 3} more</Badge>
        )}
      </div>
    </div>
  );
}
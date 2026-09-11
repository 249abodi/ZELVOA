"use client";

import { format } from "date-fns";
import { Icon, type IconName } from "@/components/icons";
import { PostStatusBadge } from "@/components/posts/post-status-badge";
import type { CalendarPost } from "@/components/calendar/calendar-grid";

const PLATFORM_ICONS: Record<string, IconName> = {
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  TIKTOK: "tiktok",
  LINKEDIN: "linkedin",
  X: "xtwitter",
};

export function CalendarList({
  posts,
  onSelectPost,
}: {
  posts: CalendarPost[];
  onSelectPost: (post: CalendarPost) => void;
}) {
  if (posts.length === 0) return null;

  const sorted = [...posts].sort((a, b) => {
    if (!a.scheduledFor || !b.scheduledFor) return 0;
    return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
  });

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {sorted.map((post) => (
        <button
          key={post.id}
          type="button"
          onClick={() => onSelectPost(post)}
          className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon name={(PLATFORM_ICONS[post.platform ?? ""] ?? "calendar-dot") as IconName} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {post.title ?? post.content.slice(0, 80)}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {post.scheduledFor ? format(new Date(post.scheduledFor), "EEEE, MMM d, yyyy \u00b7 h:mm a") : "Not scheduled"}
            </p>
          </div>
          <PostStatusBadge status={post.status} />
          <Icon name="chevron-right" size={16} className="text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
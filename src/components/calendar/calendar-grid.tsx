"use client";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from "date-fns";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface CalendarPost {
  id: string;
  title: string | null;
  content: string;
  status: string;
  postType: string;
  scheduledFor: string | null;
  platform: string | null;
}

const PLATFORM_ICONS: Record<string, IconName> = {
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  TIKTOK: "tiktok",
  LINKEDIN: "linkedin",
  X: "xtwitter",
};

export function CalendarGrid({
  month,
  posts,
  onSelectDate,
  onSelectPost,
}: {
  month: Date;
  posts: CalendarPost[];
  onSelectDate: (date: Date) => void;
  onSelectPost: (post: CalendarPost) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const postsByDay = posts.reduce<Record<string, CalendarPost[]>>((acc, post) => {
    if (!post.scheduledFor) return acc;
    const key = format(new Date(post.scheduledFor), "yyyy-MM-dd");
    acc[key] = acc[key] ?? [];
    acc[key].push(post);
    return acc;
  }, {});

  const firstDayOffset = days[0].getDay();

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div
          key={d}
          className="bg-muted px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {d}
        </div>
      ))}

      {Array.from({ length: firstDayOffset }).map((_, i) => (
        <div key={`empty-${i}`} className="min-h-20 bg-card" />
      ))}

      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayPosts = postsByDay[key] ?? [];
        const isCurrentMonth = isSameMonth(day, month);
        const isCurrentDay = isToday(day);

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDate(day)}
            className={cn(
              "group relative flex min-h-20 flex-col items-stretch gap-1 p-1.5 text-left transition-colors",
              isCurrentMonth ? "bg-card" : "bg-muted/30 text-muted-foreground/60"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                isCurrentDay && "bg-primary font-semibold text-white"
              )}
            >
              {format(day, "d")}
            </span>
            <div className="grid gap-1">
              {dayPosts.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPost(post);
                  }}
                  className="truncate rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
                >
                  <span className="flex items-center gap-1 truncate">
                    {post.platform && (
                      <Icon
                        name={PLATFORM_ICONS[post.platform] ?? "calendar-dot"}
                        size={9}
                        className="shrink-0"
                      />
                    )}
                    <span className="truncate">
                      {format(new Date(post.scheduledFor!), "h a")}
                    </span>
                  </span>
                </div>
              ))}
              {dayPosts.length > 3 && (
                <span className="px-1.5 text-[10px] text-muted-foreground">
                  +{dayPosts.length - 3} more
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
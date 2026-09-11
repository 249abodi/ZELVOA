"use client";

import {
  format,
  startOfWeek,
  addDays,
  isToday,
} from "date-fns";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { CalendarPost } from "@/components/calendar/calendar-grid";

const PLATFORM_ICONS: Record<string, IconName> = {
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  TIKTOK: "tiktok",
  LINKEDIN: "linkedin",
  X: "xtwitter",
};

export function CalendarWeek({
  week,
  posts,
  onSelectDate,
}: {
  week: Date;
  posts: CalendarPost[];
  onSelectDate: (date: Date) => void;
}) {
  const start = startOfWeek(week, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const postsByDay = posts.reduce<Record<string, CalendarPost[]>>((acc, post) => {
    if (!post.scheduledFor) return acc;
    const key = format(new Date(post.scheduledFor), "yyyy-MM-dd");
    acc[key] = acc[key] ?? [];
    acc[key].push(post);
    return acc;
  }, {});

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b border-border">
          {days.map((day) => (
            <div
              key={format(day, "eee")}
              className={cn(
                "px-2 py-3 text-center",
                isToday(day) ? "bg-primary-50 dark:bg-primary-900/20" : ""
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {format(day, "EEE")}
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-bold",
                  isToday(day) && "text-primary"
                )}
              >
                {format(day, "d")}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay[key] ?? [];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  "flex min-h-32 flex-col gap-1.5 border-r border-b border-border p-2 last:border-r-0 text-left",
                  isToday(day) ? "bg-primary-50/50 dark:bg-primary-900/10" : "hover:bg-muted/50"
                )}
              >
                {dayPosts.length === 0 && (
                  <span className="flex flex-1 items-center justify-center text-[10px] text-muted-foreground/50">
                    +
                  </span>
                )}
                {dayPosts.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-md bg-muted px-1.5 py-1 text-[11px] transition-colors hover:bg-border-strong/60 cursor-pointer"
                  >
                    <span className="flex items-center gap-1 truncate font-medium">
                      {post.platform && (
                        <Icon
                          name={PLATFORM_ICONS[post.platform] ?? "calendar-dot"}
                          size={10}
                          className="shrink-0"
                        />
                      )}
                      <span className="truncate text-muted-foreground">
                        {post.scheduledFor ? format(new Date(post.scheduledFor), "h a") : ""}
                      </span>
                    </span>
                    <p className="mt-0.5 truncate text-muted-foreground">
                      {post.title ?? post.content.slice(0, 40)}
                    </p>
                  </div>
                ))}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  addMonths,
  addWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  endOfDay,
} from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/icons";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { CalendarGrid, type CalendarPost } from "@/components/calendar/calendar-grid";
import { CalendarWeek } from "@/components/calendar/calendar-week";
import { CalendarList } from "@/components/calendar/calendar-list";
import { PostStatusBadge } from "@/components/posts/post-status-badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week" | "list";

export default function CalendarPage() {
  const router = useRouter();
  const { toastSuccess, toastError } = useToast();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);
  const [postModalOpen, setPostModalOpen] = useState(false);

  const requestKeyRef = useRef(0);

  const range = useMemo(() => {
    if (view === "month") {
      return { from: startOfMonth(cursor), to: endOfMonth(cursor) };
    }
    if (view === "week") {
      return { from: startOfWeek(cursor), to: endOfWeek(cursor) };
    }
    return { from: startOfMonth(cursor), to: endOfMonth(cursor) };
  }, [view, cursor]);

  const loadPosts = useCallback(async (filters: {
    from: Date;
    to: Date;
    platform: string;
    status: string;
  }) => {
    const search = new URLSearchParams();
    search.set("from", filters.from.toISOString());
    search.set("to", filters.to.toISOString());
    if (filters.platform) search.set("platform", filters.platform);
    if (filters.status) search.set("status", filters.status);

    const res = await fetch(`/api/v1/calendar?${search.toString()}`);
    if (!res.ok) throw new Error("Failed to load calendar");
    const data = await res.json();
    return (data.data ?? []).map((post: Record<string, unknown>) => ({
      id: post.id as string,
      title: (post.title as string) ?? null,
      content: post.content as string,
      status: post.status as string,
      postType: post.postType as string,
      scheduledFor: (post.scheduledFor as string | null) ?? null,
      platform:
        ((post.socialAccount as { platform?: string } | null)?.platform as string) ??
        (post.platform as string | null) ??
        null,
    })) as CalendarPost[];
  }, []);

  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      setError(false);
      try {
        const data = await loadPosts({ from: range.from, to: range.to, platform, status });
        if (!cancelled) setPosts(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIso, toIso, platform, status]);

  const refetch = useCallback(async () => {
    const key = ++requestKeyRef.current;
    setError(false);
    try {
      const data = await loadPosts({ from: range.from, to: range.to, platform, status });
      if (requestKeyRef.current !== key) return;
      setPosts(data);
    } catch {
      setError(true);
    }
  }, [loadPosts, range, platform, status]);

  const navigate = (dir: -1 | 1) => {
    setCursor(view === "week" ? addWeeks(cursor, dir) : addMonths(cursor, dir));
  };

  const goToday = () => setCursor(new Date());

  const handleSelectDate = (date: Date) => {
    const iso = endOfDay(date).toISOString();
    router.push(`/app/posts/create?date=${encodeURIComponent(iso)}`);
  };

  const handleSelectPost = (post: CalendarPost) => {
    setSelectedPost(post);
    setPostModalOpen(true);
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;
    if (!window.confirm("Delete this post?")) return;
    try {
      const res = await fetch(`/api/v1/posts/${selectedPost.id}`, { method: "DELETE" });
      if (!res.ok) {
        toastError("Delete failed", "Could not delete the post.");
        return;
      }
      toastSuccess("Post deleted");
      setPostModalOpen(false);
      refetch();
    } catch {
      toastError("Delete failed", "Could not delete the post.");
    }
  };

  const title =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : view === "week"
        ? `${format(range.from, "MMM d")} \u2013 ${format(range.to, "MMM d, yyyy")}`
        : format(cursor, "MMMM yyyy");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Content Calendar"
        description="Plan, schedule, and manage every post across your platforms."
        icon="calendar"
        badge={`${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
        actions={
          <Button icon="create" onClick={() => router.push("/app/posts/create")}>
            New post
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => navigate(-1)} aria-label="Previous">
              <Icon name="chevron-left" size={15} />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => navigate(1)} aria-label="Next">
              <Icon name="chevron-right" size={15} />
            </Button>
          </div>
          <h2 className="text-lg font-semibold whitespace-nowrap">{title}</h2>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            {(["month", "week", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === v
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-32"
              options={[
                { value: "", label: "All platforms" },
                { value: "INSTAGRAM", label: "Instagram" },
                { value: "FACEBOOK", label: "Facebook" },
                { value: "TIKTOK", label: "TikTok" },
                { value: "LINKEDIN", label: "LinkedIn" },
                { value: "X", label: "X" },
              ]}
            />
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-36"
              options={[
                { value: "", label: "All statuses" },
                { value: "DRAFT", label: "Draft" },
                { value: "PENDING_APPROVAL", label: "Pending approval" },
                { value: "APPROVED", label: "Approved" },
                { value: "SCHEDULED", label: "Scheduled" },
                { value: "PUBLISHED", label: "Published" },
                { value: "FAILED", label: "Failed" },
              ]}
            />
          </div>
        </div>
      </div>

      {!loaded ? (
        <LoadingState label="Loading posts..." />
      ) : error ? (
        <ErrorState
          title="Failed to load calendar"
          description="Something went wrong while fetching scheduled posts."
          onRetry={() => {
            setLoaded(false);
            refetch().then(() => setLoaded(true)).catch(() => setLoaded(true));
          }}
        />
      ) : posts.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Nothing scheduled here"
          description="Click any day to create a post, or use the button above to start drafting."
          actionLabel="New post"
          onAction={() => router.push("/app/posts/create")}
          actionIcon="create"
        />
      ) : (
        <>
          {view === "month" && (
            <CalendarGrid
              month={cursor}
              posts={posts}
              onSelectDate={handleSelectDate}
              onSelectPost={handleSelectPost}
            />
          )}
          {view === "week" && (
            <CalendarWeek
              week={cursor}
              posts={posts}
              onSelectDate={handleSelectDate}
            />
          )}
          {view === "list" && (
            <CalendarList posts={posts} onSelectPost={handleSelectPost} />
          )}
        </>
      )}

      <Modal
        open={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        title={selectedPost?.title ?? "Post"}
        description={
          selectedPost?.scheduledFor
            ? format(new Date(selectedPost.scheduledFor), "EEEE, MMM d, yyyy \u00b7 h:mm a")
            : "Unscheduled"
        }
      >
        {selectedPost && (
          <div className="grid gap-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {selectedPost.content}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <PostStatusBadge status={selectedPost.status} />
              <span className="text-xs text-muted-foreground">
                {selectedPost.postType.toLowerCase()} post
              </span>
              {selectedPost.platform && (
                <span className="text-xs text-muted-foreground">
                  for {selectedPost.platform.toLowerCase()}
                </span>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  router.push(`/app/posts/create?edit=${selectedPost.id}`);
                }}
                icon="edit"
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                icon="trash"
                onClick={handleDeletePost}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
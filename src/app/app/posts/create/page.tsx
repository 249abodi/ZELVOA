"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PostEditor } from "@/components/posts/post-editor";
import { ComposerAIPanel } from "@/components/posts/ai-composer-panel";
import { PlatformSelector, type PostAccount } from "@/components/posts/post-platform-selector";
import { PostMediaPicker } from "@/components/posts/post-media-picker";
import { getPlatformLimits } from "@/lib/integrations/platforms";
import type { Platform } from "@/lib/integrations/types";

interface LoadedPost {
  id: string;
  title: string | null;
  content: string;
  postType: string;
  scheduledFor: string | null;
  variants: { platform: string }[];
  media: { mediaAssetId: string }[];
}

export default function CreatePostPage() {
  const { toastSuccess, toastError, toastInfo } = useToast();
  const [accounts, setAccounts] = useState<PostAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [accountsError, setAccountsError] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("STANDARD");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (editId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingPostId(editId);
    }
  }, []);

  const accountsRef = useRef<PostAccount[]>([]);
  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/accounts");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        const list = (data.data ?? []) as PostAccount[];
        const connected = list.filter((a) => a.status === "CONNECTED");
        setAccounts(connected);
        if (connected.length > 0) {
          setSelectedAccounts([connected[0].id]);
        }
      } catch {
        if (!cancelled) setAccountsError(true);
      } finally {
        if (!cancelled) setAccountsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editingPostId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/posts/${editingPostId}`);
        if (!res.ok) return;
        const data = await res.json();
        const post = data.data as LoadedPost;
        if (!post || cancelled) return;
        setTitle(post.title ?? "");
        setContent(post.content ?? "");
        setPostType(post.postType ?? "STANDARD");
        setSelectedMedia(post.media?.map((m) => m.mediaAssetId) ?? []);
        if (post.scheduledFor) {
          setScheduledFor(new Date(post.scheduledFor).toISOString().slice(0, 16));
        }
        const platformSet = new Set(post.variants?.map((v) => v.platform) ?? []);
        const matched = accountsRef.current
          .filter((a) => platformSet.has(a.platform as string))
          .map((a) => a.id);
        if (matched.length > 0) setSelectedAccounts(matched);
      } catch {
        if (!cancelled) toastError("Failed to load post", "Could not load the post for editing.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingPostId, toastError]);

  const handleEditorChange = useCallback(
    (data: { title: string; content: string; postType: string }) => {
      setTitle(data.title);
      setContent(data.content);
      setPostType(data.postType);
    },
    []
  );

  const canSubmit = selectedAccounts.length > 0 && content.trim().length > 0;

  const captionLimit = (() => {
    const limits = selectedAccounts
      .map((id) => accounts.find((a) => a.id === id)?.platform as Platform | undefined)
      .filter((p): p is Platform => Boolean(p))
      .map((p) => getPlatformLimits(p).captionLimit);
    return limits.length > 0 ? Math.min(...limits) : 2200;
  })();

  const save = async (scheduled: boolean, silent = false): Promise<string | null> => {
    if (!canSubmit) {
      toastError("Cannot save", "Add content and select at least one platform.");
      return null;
    }

    setSaving(true);
    try {
      const body = {
        title: title.trim() || undefined,
        content: content.trim(),
        postType,
        socialAccountIds: selectedAccounts,
        mediaAssetIds: selectedMedia.length > 0 ? selectedMedia : undefined,
        scheduledFor: scheduled ? scheduledFor : undefined,
      };

      const res = await fetch(editingPostId ? `/api/v1/posts/${editingPostId}` : "/api/v1/posts", {
        method: editingPostId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toastError("Save failed", err?.error?.message ?? "Could not save your post.");
        return null;
      }

      const data = (await res.json().catch(() => null)) as { data?: { id?: string } } | null;
      const savedId = data?.data?.id ?? null;

      if (!silent) {
        toastSuccess(
          scheduled
            ? "Post scheduled"
            : editingPostId
              ? "Draft updated"
              : "Draft saved",
          scheduled ? "Your post has been scheduled." : "You can come back and finish it anytime."
        );
      }

      if (!editingPostId) {
        setTitle("");
        setContent("");
        setScheduledFor("");
        setSelectedMedia([]);
      }

      return savedId;
    } catch {
      toastError("Save failed", "Could not save your post.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const publishNow = async () => {
    if (!canSubmit) {
      toastError("Cannot publish", "Add content and select at least one platform.");
      return;
    }

    setPublishing(true);
    try {
      const savedId = await save(false, true);
      if (!savedId) return;

      const res = await fetch(`/api/v1/posts/${savedId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialAccountIds: selectedAccounts }),
      });
      const data = (await res.json().catch(() => null)) as {
        data?: { targetCount?: number; outcomes?: { status?: string; errorCode?: string }[] };
        error?: { message?: string };
      } | null;

      if (!res.ok) {
        toastError("Publish failed", data?.error?.message ?? "Could not publish the post.");
        return;
      }

      const outcomes = data?.data?.outcomes ?? [];
      const publishedCount = outcomes.filter((o) => o.status === "PUBLISHED").length;
      const failedCount = outcomes.filter((o) => o.status !== "PUBLISHED").length;

      if (publishedCount > 0 && failedCount === 0) {
        toastSuccess(
          "Post published",
          `Published to ${publishedCount} platform${publishedCount > 1 ? "s" : ""}.`
        );
      } else if (publishedCount > 0) {
        toastInfo(
          "Partially published",
          `${publishedCount} published, ${failedCount} need${failedCount === 1 ? "s" : ""} attention.`
        );
      } else {
        const first = outcomes[0]?.errorCode;
        toastError("Publish failed", first ? `Code: ${first}` : "Could not publish the post.");
      }

      if (!editingPostId) {
        setTitle("");
        setContent("");
        setScheduledFor("");
        setSelectedMedia([]);
      }
    } catch {
      toastError("Publish failed", "Could not publish the post.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title={editingPostId ? "Edit Post" : "Create Post"}
        description="Compose, customize per platform, and save as a draft or schedule it."
        icon="create"
      />

      {!accountsLoaded ? (
        <LoadingState label="Loading your social accounts..." />
      ) : accountsError ? (
        <ErrorState
          title="Failed to load accounts"
          description="Cannot reach the accounts service right now."
          onRetry={() => window.location.reload()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-6">
            <Card>
              <CardContent className="grid gap-4 p-5 pt-5">
                <PostEditor
                  initialTitle={title}
                  initialContent={content}
                  initialType={postType}
                  captionLimit={captionLimit}
                  onChange={handleEditorChange}
                />
              </CardContent>
            </Card>

            <ComposerAIPanel
              content={content}
              platform={selectedAccounts[0]
                ? accounts.find((a) => a.id === selectedAccounts[0])?.platform as string | undefined
                : undefined}
              onInsertText={(text) => {
                setContent(text);
                handleEditorChange({ title, content: text, postType });
              }}
              onAppendHashtags={(tags) => {
                const current = content.trim();
                const next = current ? `${current}\n\n${tags.join(" ")}` : tags.join(" ");
                setContent(next);
                handleEditorChange({ title, content: next, postType });
              }}
            />

            <Card>
              <CardContent className="grid gap-4 p-5 pt-5">
                <PlatformSelector
                  accounts={accounts}
                  selected={selectedAccounts}
                  onChange={setSelectedAccounts}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-4 p-5 pt-5">
                <PostMediaPicker
                  selected={selectedMedia}
                  onChange={setSelectedMedia}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 self-start lg:sticky lg:top-20">
            <Card>
              <CardContent className="grid gap-4 p-5 pt-5">
                <div>
                  <label htmlFor="schedule" className="text-sm font-medium">
                    Schedule for
                  </label>
                  <Input
                    id="schedule"
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave empty to save as a draft.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Button
                    onClick={() => save(true)}
                    loading={publishing || saving}
                    disabled={!canSubmit}
                    icon="calendar-dot"
                  >
                    Schedule
                  </Button>
                  <Button
                    onClick={() => save(false)}
                    loading={saving}
                    disabled={!canSubmit}
                    variant="outline"
                    icon="save"
                  >
                    {editingPostId ? "Update draft" : "Save draft"}
                  </Button>
                  <Button
                    onClick={() => publishNow()}
                    loading={publishing}
                    disabled={!canSubmit}
                    icon="zap"
                  >
                    Publish now
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Publishing goes live when provider integrations are enabled.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
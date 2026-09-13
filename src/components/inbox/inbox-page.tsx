"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type ConversationStatusValue,
  CONVERSATION_STATUS_OPTIONS,
  statusOptionLabel,
  isConversationStatus,
  assigneeOptionLabel,
} from "@/lib/inbox/ui";

interface InboxConversation {
  id: string;
  platform: string;
  contactName: string;
  contactUsername: string | null;
  contactAvatarUrl: string | null;
  status: ConversationStatusValue;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  tags: string[];
  unread: number;
  lastMessage: string | null;
  lastMessageAt: string;
  assignee: { id: string; name: string; email: string } | null;
  account: { id: string; name: string; platform: string } | null;
}

interface InboxMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  sentAt: string;
  read: boolean;
  sender: { id: string; name: string } | null;
}

interface ThreadDetail {
  id: string;
  platform: string;
  contactName: string;
  contactUsername: string | null;
  contactAvatarUrl: string | null;
  status: ConversationStatusValue;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  tags: string[];
  notes: string | null;
  devMode: boolean;
  assignee: { id: string; name: string; email: string } | null;
  account: { id: string; name: string; platform: string } | null;
  messages: InboxMessage[];
}

interface Assignee {
  id: string;
  name: string;
  email: string;
  role: string;
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...CONVERSATION_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];

const ASSIGNEE_FILTER_OPTIONS = [
  { value: "", label: "Any assignee" },
  { value: "me", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low priority" },
  { value: "NORMAL", label: "Normal priority" },
  { value: "HIGH", label: "High priority" },
  { value: "URGENT", label: "Urgent" },
] as const;

const PRIORITY_ORDER: Record<string, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };

export default function InboxPageClient({ canReply, canAssign }: { canReply: boolean; canAssign: boolean }) {
  const { toastSuccess, toastError } = useToast();
  const [conversations, setConversations] = useState<InboxConversation[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [tagsDraft, setTagsDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");

  const load = useCallback(
    async (abort?: AbortSignal) => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (assigneeFilter) params.set("assignee", assigneeFilter);
      if (query) params.set("query", query);
      const res = await fetch(`/api/v1/inbox?${params.toString()}`, { signal: abort });
      if (!res.ok) throw new Error("load_failed");
      const data = (await res.json()) as { data: { conversations: InboxConversation[] } };
      setConversations(data.data.conversations);
    },
    [statusFilter, assigneeFilter, query]
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => load(new AbortController().signal))
      .catch(() => {
        if (cancelled) return;
        setConversations([]);
        toastError("Could not load inbox.");
      });
    return () => {
      cancelled = true;
    };
  }, [load, toastError]);

  const selectThread = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setThreadLoading(true);
      try {
        const res = await fetch(`/api/v1/inbox/${id}`);
        const data = (await res.json()) as { data?: ThreadDetail; error?: { message?: string } };
        if (!res.ok || !data.data) throw new Error(data.error?.message ?? "load_failed");
        setThread(data.data);
        setTagsDraft(data.data.tags.join(", "));
        setNotesDraft(data.data.notes ?? "");
      } catch (err) {
        toastError("Conversation failed to load", err instanceof Error ? err.message : undefined);
      } finally {
        setThreadLoading(false);
      }
    },
    [toastError]
  );

  useEffect(() => {
    if (conversations && selectedId) {
      const fresh = conversations.find((c) => c.id === selectedId);
      if (fresh && fresh.unread > 0) {
        void Promise.resolve().then(async () => {
          const res = await fetch(`/api/v1/inbox/${selectedId}`);
          const data = (await res.json()) as { data?: ThreadDetail };
          if (data.data) setThread(data.data);
          void load(new AbortController().signal);
        });
      }
    }
  }, [conversations, selectedId, load]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/v1/inbox/sync", { method: "POST" });
      const data = (await res.json()) as {
        data?: { fetchedConversations: number; fetchedMessages: number; devMode: boolean };
        error?: { message?: string };
      };
      if (!res.ok || !data.data) throw new Error(data.error?.message ?? "sync_failed");
      toastSuccess(
        `Synced ${data.data.fetchedConversations} conversations`,
        `${data.data.fetchedMessages} new messages` + (data.data.devMode ? " (development mode)" : "")
      );
      await load(new AbortController().signal);
    } catch (err) {
      toastError("Sync failed", err instanceof Error ? err.message : undefined);
    } finally {
      setSyncing(false);
    }
  }, [load, toastSuccess, toastError]);

  const loadAssignees = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/inbox/assignees");
      const data = (await res.json()) as { data?: { assignees: Assignee[] } };
      if (data.data) setAssignees(data.data.assignees);
    } catch {
      setAssignees([]);
    }
  }, []);

  useEffect(() => {
    if (canAssign) {
      void Promise.resolve().then(loadAssignees);
    }
  }, [canAssign, loadAssignees]);

  const setStatus = useCallback(
    async (next: ConversationStatusValue) => {
      if (!thread || next === thread.status) return;
      try {
        const res = await fetch(`/api/v1/inbox/${thread.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const data = (await res.json()) as { data?: { status: ConversationStatusValue }; error?: { message?: string } };
        if (!res.ok || !data.data) throw new Error(data.error?.message ?? "status_failed");
        const persisted: ConversationStatusValue = isConversationStatus(data.data.status) ? data.data.status : next;
        setThread((prev) => (prev ? { ...prev, status: persisted } : prev));
        toastSuccess(statusOptionLabel(persisted));
        void load(new AbortController().signal);
      } catch {
        toastError("Could not update status");
      }
    },
    [thread, load, toastSuccess, toastError]
  );

  const setPriority = useCallback(
    async (priority: ThreadDetail["priority"]) => {
      if (!thread) return;
      setThread((prev) => (prev ? { ...prev, priority } : prev));
      try {
        await fetch(`/api/v1/inbox/${thread.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority }),
        });
      } catch {
        toastError("Could not update priority");
      }
    },
    [thread, toastError]
  );

  const setAssignee = useCallback(
    async (assigneeId: string) => {
      if (!thread) return;
      try {
        const res = await fetch(`/api/v1/inbox/${thread.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assigneeId: assigneeId || null }),
        });
        const data = (await res.json()) as {
          data?: { assignee: { id: string; name: string; email: string } | null; status: ConversationStatusValue };
          error?: { message?: string };
        };
        if (!res.ok || !data.data) throw new Error(data.error?.message ?? "assign_failed");
        const nextStatus = isConversationStatus(data.data.status) ? data.data.status : thread.status;
        setThread((prev) =>
          prev
            ? {
                ...prev,
                assignee: data.data!.assignee,
                status: nextStatus,
              }
            : prev
        );
        toastSuccess(data.data.assignee ? `Assigned to ${data.data.assignee.name}` : "Unassigned");
        void load(new AbortController().signal);
      } catch (err) {
        toastError("Assignment failed", err instanceof Error ? err.message : undefined);
      }
    },
    [thread, load, toastSuccess, toastError]
  );

  const saveDraft = useCallback(async () => {
    if (!thread) return;
    const payload: Record<string, unknown> = {};
    const tags = tagsDraft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (tagsChanged(thread.tags, tags)) payload.tags = tags;
    if (notesDraft.trim() !== (thread.notes ?? "")) payload.notes = notesDraft.trim() || null;
    if (Object.keys(payload).length === 0) return;
    try {
      const res = await fetch(`/api/v1/inbox/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(data.error?.message ?? "save_failed");
      setThread((prev) => (prev ? { ...prev, tags, notes: payload.notes === null ? null : String(notesDraft.trim()) } : prev));
      toastSuccess("Details saved");
    } catch (err) {
      toastError("Save failed", err instanceof Error ? err.message : undefined);
    }
  }, [thread, tagsDraft, notesDraft, toastSuccess, toastError]);

  const sendReply = useCallback(async () => {
    if (!thread || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v1/inbox/${thread.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      });
      const data = (await res.json()) as {
        data?: { id: string; content: string; sentAt: string; sender: { id: string; name: string } | null; devOnly: boolean };
        error?: { message?: string };
      };
      if (!res.ok || !data.data) throw new Error(data.error?.message ?? "reply_failed");
      setReply("");
      setThread((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  id: data.data!.id,
                  direction: "OUTBOUND",
                  content: data.data!.content,
                  sentAt: data.data!.sentAt,
                  read: true,
                  sender: data.data!.sender,
                },
              ],
            }
          : prev
      );
      toastSuccess("Reply sent");
      void load(new AbortController().signal);
    } catch (err) {
      toastError("Reply failed", err instanceof Error ? err.message : undefined);
    } finally {
      setSending(false);
    }
  }, [thread, reply, load, toastSuccess, toastError]);

  const sorted = useMemo(() => {
    if (!conversations) return null;
    return [...conversations]
      .filter((c) => c.status !== "ARCHIVED" || statusFilter === "ARCHIVED")
      .sort((a, b) => {
        const weight = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
        return weight !== 0 ? weight : new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
  }, [conversations, statusFilter]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Inbox"
        description="Customer conversations from your connected accounts."
        icon="send"
        badge={canReply ? undefined : "Read-only"}
        actions={
          <Button variant="outline" icon="refresh" loading={syncing} onClick={sync}>
            Sync
          </Button>
        }
      />

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <Icon name="send" size={14} />
        <span>Syncing pulls inbound conversations. Development-mode accounts use scripted dev data that is clearly labelled.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-3 self-start lg:col-span-1 lg:sticky lg:top-20">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_FILTER_OPTIONS}
            />
            <Select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              options={ASSIGNEE_FILTER_OPTIONS}
            />
          </div>
          <div className="relative">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setQuery(searchInput.trim());
              }}
              placeholder="Search conversations…"
              className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {!sorted ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Icon name="spinner" size={16} className="animate-spin text-primary" />
                Loading…
              </div>
            ) : sorted.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No conversations yet.
                <br />
                <button className="mt-1 font-medium text-primary" onClick={sync}>
                  Run a sync
                </button>
              </div>
            ) : (
              sorted.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectThread(c.id)}
                  className={cn(
                    "block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-background-subtle",
                    selectedId === c.id && "bg-background-subtle"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          c.priority === "URGENT"
                            ? "bg-destructive"
                            : c.priority === "HIGH"
                              ? "bg-warning"
                              : "bg-muted-foreground/40"
                        )}
                      />
                      <span className="truncate text-sm font-medium text-foreground">{c.contactName}</span>
                    </div>
                    {c.unread > 0 && <Badge variant="destructive" className="shrink-0">{c.unread}</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.lastMessage ?? "No messages"}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{c.account?.name ?? c.platform}</span>
                    <span className="shrink-0">{formatDateTime(c.lastMessageAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-background-subtle px-6 py-20 text-center">
              <Icon name="send" size={26} className="text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Select a conversation to view the thread.</p>
            </div>
          ) : threadLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-16 text-sm text-muted-foreground">
              <Icon name="spinner" size={16} className="animate-spin text-primary" />
              Loading conversation…
            </div>
          ) : thread ? (
            <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon name="user" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{thread.contactName}</p>
                    <p className="text-xs text-muted-foreground">
                      {thread.contactUsername ?? thread.platform} · {thread.account?.name ?? "No account"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {thread.devMode && <Badge variant="warning">Dev mode</Badge>}
                  <Select
                    className="h-8 w-auto text-xs"
                    value={thread.status}
                    onChange={(e) => setStatus(e.target.value as ConversationStatusValue)}
                    options={CONVERSATION_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                  <Select
                    className="h-8 w-auto text-xs"
                    value={thread.priority}
                    onChange={(e) => setPriority(e.target.value as ThreadDetail["priority"])}
                    options={PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Assignee</label>
                    {canAssign && (
                      <button className="text-xs font-medium text-primary" onClick={() => setAssignee("")}>
                        Unassign
                      </button>
                    )}
                  </div>
                  {canAssign ? (
                    <>
                      <Select
                        value={thread.assignee?.id ?? ""}
                        onChange={(e) => setAssignee(e.target.value)}
                        options={[
                          { value: "", label: "Unassigned" },
                          ...assignees.map((a) => ({
                            value: a.id,
                            label: assigneeOptionLabel(a.name, a.email),
                          })),
                        ]}
                      />
                      {thread.assignee && (
                        <p className="text-[11px] text-muted-foreground">{thread.assignee.email}</p>
                      )}
                    </>
                  ) : (
                    <div className="grid gap-0.5">
                      <p className="text-sm text-foreground">{thread.assignee?.name ?? "Unassigned"}</p>
                      {thread.assignee && (
                        <p className="text-[11px] text-muted-foreground">{thread.assignee.email}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tags</label>
                  <input
                    value={tagsDraft}
                    onChange={(e) => setTagsDraft(e.target.value)}
                    placeholder="comma, separated, tags"
                    className="h-10 rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={2}
                    placeholder="Internal notes for your team…"
                    className="resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  />
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={saveDraft} icon="check">
                      Save details
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid max-h-[420px] gap-3 overflow-y-auto p-4">
                {thread.messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                      m.direction === "OUTBOUND"
                        ? "justify-self-end bg-primary text-primary-contrast"
                        : "justify-self-start bg-background-subtle"
                    )}
                  >
                    <p>{m.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-[11px]",
                        m.direction === "OUTBOUND" ? "text-primary-contrast/70" : "text-muted-foreground"
                      )}
                    >
                      {m.direction === "OUTBOUND" ? (m.sender?.name ?? "You") : thread.contactName} ·{" "}
                      {formatDateTime(m.sentAt)}
                    </p>
                  </div>
                ))}
              </div>

              {canReply ? (
                <div className="border-t border-border p-4">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder={thread.devMode ? "Write a reply (stored locally in development mode)…" : "Write a reply…"}
                    className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  />
                  <div className="mt-2 flex justify-between">
                    <p className="text-xs text-muted-foreground">
                      {thread.devMode ? "Replies in dev mode are stored locally only." : ""}
                    </p>
                    <Button icon="send" loading={sending} disabled={!reply.trim()} onClick={sendReply}>
                      Send reply
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  Your role does not allow replying in the inbox.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function tagsChanged(prev: string[], next: string[]): boolean {
  const a = [...prev].sort();
  const b = [...next].sort();
  return a.join("|") !== b.join("|");
}
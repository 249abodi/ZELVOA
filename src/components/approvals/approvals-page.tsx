"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";

interface ApprovalItem {
  id: string;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  requestedAt: string;
  resolvedAt: string | null;
  post: {
    id: string;
    title: string | null;
    content: string;
    status: string;
    socialAccount: { name: string; platform: string } | null;
  };
  requester: { id: string; name: string; email: string };
  actions: {
    action: string;
    comment: string | null;
    createdAt: string;
    actor: { name: string };
  }[];
}

interface ApprovalDetail {
  id: string;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  requestedAt: string;
  resolvedAt: string | null;
  post: {
    id: string;
    title: string | null;
    content: string;
    status: string;
    scheduledFor: string | null;
    socialAccount: { id: string; name: string; platform: string } | null;
  };
  requester: { id: string; name: string; email: string };
  actions: {
    action: string;
    comment: string | null;
    createdAt: string;
    actor: { id: string; name: string; email: string };
  }[];
}

const STATUS_FILTER = [
  { value: "", label: "All requests" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "CHANGES_REQUESTED", label: "Changes requested" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_VARIANT: Record<ApprovalItem["status"], "default" | "success" | "warning" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  CHANGES_REQUESTED: "default",
  REJECTED: "destructive",
};

export default function ApprovalsPageClient({ canApprove }: { canApprove: boolean }) {
  const { toastSuccess, toastError } = useToast();
  const [approvals, setApprovals] = useState<ApprovalItem[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApprovalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      const res = await fetch(`/api/v1/approvals?${q.toString()}`);
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as { data: { approvals: ApprovalItem[] } };
      setApprovals(json.data.approvals);
    } catch {
      toastError("Could not load approvals.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toastError]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setComment("");
    try {
      const res = await fetch(`/api/v1/approvals/${id}`);
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as { data: ApprovalDetail };
      setSelected(json.data);
    } catch {
      toastError("Could not load approval details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (action: "APPROVE" | "REQUEST_CHANGES" | "REJECT") => {
    if (!selected) return;
    setActing(true);
    try {
      const res = await fetch(`/api/v1/approvals/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error("action_failed");
      toastSuccess("Approval updated.");
      setSelected(null);
      await load();
    } catch {
      toastError("Could not update approval.");
    } finally {
      setActing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Professional approval workflow with full audit records."
        icon="approvals"
      />

      <div className="mb-6 flex items-center gap-2">
        <Icon name="filter" size={15} className="text-muted-foreground" />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={STATUS_FILTER}
          className="w-48"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Icon name="spinner" size={16} className="animate-spin" />
          Loading approvals…
        </div>
      ) : approvals && approvals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/30">
            <Icon name="approvals" size={24} />
          </div>
          <h2 className="mt-4 text-base font-semibold">No approval requests</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Posts can be submitted for approval before publishing. Once a draft
            is submitted, it appears here for review.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Post</th>
                  <th className="px-4 py-3 font-medium">Requested</th>
                  <th className="px-4 py-3 font-medium">Requester</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Review</th>
                </tr>
              </thead>
              <tbody>
                {(approvals ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-6 py-3">
                      <div className="line-clamp-1 max-w-xs font-medium">{a.post.title ?? a.post.content}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {a.post.socialAccount
                          ? `${a.post.socialAccount.name} · ${a.post.socialAccount.platform.toLowerCase()}`
                          : "draft"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.requestedAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.requester.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[a.status]}>{a.status.toLowerCase()}</Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openDetail(a.id)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Review approval"
        description={selected ? `Requested by ${selected.requester.name} on ${selected.requestedAt.slice(0, 10)}` : undefined}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <Icon name="spinner" size={16} className="animate-spin" />
            Loading…
          </div>
        ) : selected ? (
          <div className="grid gap-5">
            <div className="rounded-xl bg-muted/50 p-4">
              <h3 className="text-sm font-semibold">
                {selected.post.title ?? "Untitled post"}
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {selected.post.content}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{selected.post.status.toLowerCase()}</Badge>
                {selected.post.socialAccount && (
                  <span>
                    {selected.post.socialAccount.name} ·{" "}
                    {selected.post.socialAccount.platform.toLowerCase()}
                  </span>
                )}
                {selected.post.scheduledFor && (
                  <span>Scheduled {selected.post.scheduledFor.slice(0, 16).replace("T", " ")}</span>
                )}
              </div>
            </div>

            {selected.actions.length > 0 && (
              <div className="grid gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Activity
                </h4>
                {selected.actions.map((act) => (
                  <div key={act.createdAt + act.action} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-muted-foreground">•</span>
                    <div>
                      <span className="font-medium">{act.actor.name}</span>{" "}
                      <span className="text-muted-foreground">
                        — {act.action.toLowerCase().replace("_", " ")}
                        {act.comment && <span className="block italic">&quot;{act.comment}&quot;</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canApprove && selected.status === "PENDING" && (
              <div className="grid gap-3 border-t border-border pt-4">
                <label className="text-sm font-medium">Review comment (optional)</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add context for your decision…"
                  rows={3}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleAction("REQUEST_CHANGES")}
                    disabled={acting}
                  >
                    Request changes
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleAction("REJECT")}
                    disabled={acting}
                  >
                    Reject
                  </Button>
                  <Button onClick={() => handleAction("APPROVE")} disabled={acting}>
                    {acting ? "Submitting…" : "Approve"}
                  </Button>
                </div>
              </div>
            )}

            {selected.status !== "PENDING" && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                This request has been resolved.
              </p>
            )}

            {!canApprove && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                You do not have permission to act on approval requests.
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
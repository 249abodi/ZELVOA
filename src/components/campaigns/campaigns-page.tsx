"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
  createdAt: string;
  postCount: number;
  snapshotCount: number;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
];

const STATUS_FILTER: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  ...STATUS_OPTIONS,
];

const STATUS_VARIANT: Record<Campaign["status"], "default" | "success" | "warning" | "secondary"> = {
  DRAFT: "secondary",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "default",
};

export default function CampaignsPageClient({ canManage }: { canManage: boolean }) {
  const { toastSuccess, toastError } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    goal: "",
    startDate: "",
    endDate: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      const res = await fetch(`/api/v1/campaigns?${q.toString()}`);
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as { data: { campaigns: Campaign[] } };
      setCampaigns(json.data.campaigns);
    } catch {
      toastError("Could not load campaigns.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toastError]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const openCreate = () => {
    setForm({ name: "", description: "", goal: "", startDate: "", endDate: "" });
    setCreating(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toastError("A campaign name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          goal: form.goal.trim() || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("create_failed");
      toastSuccess("Campaign created.");
      setCreating(false);
      await load();
    } catch {
      toastError("Could not create campaign.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (campaign: Campaign, status: string) => {
    try {
      const res = await fetch(`/api/v1/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("update_failed");
      toastSuccess("Campaign updated.");
      await load();
    } catch {
      toastError("Could not update campaign.");
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    try {
      const res = await fetch(`/api/v1/campaigns/${campaign.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      toastSuccess("Campaign deleted.");
      await load();
    } catch {
      toastError("Could not delete campaign.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Plan, run, and report on structured campaigns."
        icon="campaigns"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Icon name="plus" size={15} />
              New campaign
            </Button>
          ) : undefined
        }
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
          Loading campaigns…
        </div>
      ) : campaigns && campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/30">
            <Icon name="campaigns" size={24} />
          </div>
          <h2 className="mt-4 text-base font-semibold">No campaigns yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create your first campaign to group posts, track goals, and report on
            reach and engagement together.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campaigns?.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{c.name}</h3>
                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[c.status]}>{c.status.toLowerCase()}</Badge>
              </div>

              {c.goal && (
                <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Goal</span>
                  <p className="mt-0.5 line-clamp-2">{c.goal}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {c.startDate && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="calendar" size={13} />
                    {c.startDate}
                    {c.endDate ? ` → ${c.endDate}` : ""}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Icon name="create" size={13} />
                  {c.postCount} post{c.postCount === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="analytics" size={13} />
                  {c.snapshotCount} snapshot{c.snapshotCount === 1 ? "" : "s"}
                </span>
              </div>

              {canManage && (
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
                  <Select
                    value={c.status}
                    onChange={(e) => handleStatusChange(c, e.target.value)}
                    options={STATUS_OPTIONS}
                    className="h-9 w-36 text-xs"
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c)}>
                    <Icon name="trash" size={15} />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New campaign">
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Summer launch"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-desc">Description</Label>
            <Input
              id="campaign-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-goal">Goal</Label>
            <Input
              id="campaign-goal"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-start">Start date</Label>
              <Input
                id="campaign-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-end">End date</Label>
              <Input
                id="campaign-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create campaign"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
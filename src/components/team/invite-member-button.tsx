"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage, pluralize } from "@/lib/utils";
import { ROLES } from "@/lib/rbac";

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  expired: boolean;
  daysLeft: number;
  expiresAt: string;
  createdAt: string;
}

const INVITABLE_ROLES = [
  "ADMIN",
  "CONTENT_MANAGER",
  "DESIGNER",
  "SOCIAL_MEDIA_MANAGER",
  "VIEWER",
];

export function InviteMemberButton() {
  const { toastSuccess, toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [saving, setSaving] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/invitations");
      const json = await res.json();
      if (res.ok && json.data?.invitations) {
        const now = Date.now();
        setPending(
          (json.data.invitations as PendingInvite[]).map((inv) => ({
            ...inv,
            expired: inv.expired || new Date(inv.expiresAt).getTime() <= now,
            daysLeft: Math.max(1, Math.ceil((new Date(inv.expiresAt).getTime() - now) / 86400000)),
          }))
        );
      }
    } catch {
      // ignore background refresh failures
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(loadPending);
  }, [open, loadPending]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/v1/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not send invitation.");
      setInviteUrl(json.data.inviteUrl);
      setEmail("");
      setRole("VIEWER");
      toastSuccess("Invitation created", "Share the link with the invited person.");
      await loadPending();
    } catch (err) {
      toastError("Could not create invitation", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toastSuccess("Link copied", "Paste it anywhere to share the invitation.");
    } catch {
      toastError("Could not copy", "Copy the link manually from the input below.");
    }
  }

  async function revoke(id: string) {
    setRevoking(id);
    try {
      const res = await fetch("/api/v1/invitations/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not revoke invitation.");
      toastSuccess("Invitation revoked");
      await loadPending();
    } catch (err) {
      toastError("Could not revoke invitation", getErrorMessage(err));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <>
      <Button icon="user" onClick={() => setOpen(true)}>
        Invite member
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setInviteUrl(null);
        }}
        title="Invite a teammate"
        description="They'll get a secure link to join this workspace."
        size="md"
      >
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon="mail"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={INVITABLE_ROLES.map((r) => ({
                value: r,
                label: ROLES.find((x) => x.value === r)?.label ?? r,
              }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" loading={saving}>
              Create invitation
            </Button>
            <p className="text-xs text-muted-foreground">
              Invitations expire after 7 days.
            </p>
          </div>
        </form>

        {inviteUrl && (
          <div className="mt-4 grid gap-2 rounded-xl border border-primary/30 bg-primary-50/40 p-4 dark:bg-primary-900/15">
            <p className="text-sm font-medium">Invitation link ready</p>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copyLink}>
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can join as{" "}
              {ROLES.find((x) => x.value === role)?.label ?? role}. Revoke it anytime.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Pending invitations ({pending.length})
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {pending.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLES.find((r) => r.value === inv.role)?.label ?? inv.role}
                      {inv.expired && " · Expired"}
                      {!inv.expired && ` · ${pluralize(inv.daysLeft, "day")} left`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={revoking === inv.id}
                    onClick={() => revoke(inv.id)}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
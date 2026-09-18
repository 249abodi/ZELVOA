"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/utils";
import { ROLES } from "@/lib/rbac";

interface InvitePreview {
  invitation: {
    email: string;
    role: string;
    status: string;
    expiresAt: string;
  };
  organization: { id: string; name: string; slug: string } | null;
  workspace: { id: string; name: string } | null;
  isValid: boolean;
  isLoggedIn: boolean;
  userEmail: string | null;
}

const roleLabel = (role: string) =>
  ROLES.find((r) => r.value === role)?.label ?? role;

export function InviteAcceptance({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<{
    loading: boolean;
    data?: InvitePreview | null;
    error?: string | null;
    accepting?: boolean;
  }>({ loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/invitations/preview?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || "Invitation not found.");
        if (!cancelled) setState({ loading: false, data: json.data });
      } catch (err) {
        if (!cancelled) setState({ loading: false, data: null, error: getErrorMessage(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setState((s) => ({ ...s, accepting: true, error: null }));
    try {
      const preview = state.data;
      if (!preview?.isLoggedIn) {
        router.push(`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`);
        return;
      }
      const res = await fetch("/api/v1/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Could not accept invitation.");
      router.push("/app/dashboard");
      router.refresh();
    } catch (err) {
      setState((s) => ({ ...s, accepting: false, error: getErrorMessage(err) }));
    }
  }

  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Icon name="spinner" size={20} className="animate-spin" />
        <span className="ml-2 text-sm">Loading invitation…</span>
      </div>
    );
  }

  const d = state.data;

  if (!d || !state.data?.isValid) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Icon name="alert-circle" size={24} />
        </div>
        <h1 className="text-xl font-bold">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.error ??
            (d?.invitation.status === "ACCEPTED"
              ? "This invitation has already been used."
              : "This invitation is invalid or has expired. Ask the sender to invite you again.")}
        </p>
      </div>
    );
  }

  const emailMismatch = d.isLoggedIn && d.userEmail && d.userEmail.toLowerCase() !== d.invitation.email.toLowerCase();

  return (
    <div className="rounded-2xl border border-border bg-card p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">You&apos;ve been invited</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.organization?.name ?? "An organization"} has invited you to join their workspace.
          </p>
        </div>
        <Badge variant="outline">
          {roleLabel(d.invitation.role)}
        </Badge>
      </div>

      <dl className="mb-6 grid gap-3 rounded-xl bg-background-subtle p-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Organization</dt>
          <dd className="font-medium">{d.organization?.name ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Workspace</dt>
          <dd className="font-medium">{d.workspace?.name ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Invited email</dt>
          <dd className="font-medium">{d.invitation.email}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium">{roleLabel(d.invitation.role)}</dd>
        </div>
      </dl>

      {state.error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <Icon name="alert-circle" size={16} />
          {state.error}
        </div>
      )}

      {!d.isLoggedIn ? (
        <div className="grid gap-3">
          <Button onClick={accept} loading={state.accepting}>
            Log in to accept invitation
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href={`/register?next=/invite?token=${encodeURIComponent(token)}`}
              className="font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Create a free account
            </Link>
          </p>
        </div>
      ) : emailMismatch ? (
        <div>
          <p className="mb-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-warning">
            You are logged in as{" "}
            <span className="font-medium">{d.userEmail}</span>. This invitation was sent to{" "}
            <span className="font-medium">{d.invitation.email}</span>. Log in or create an account with the invited
            email to accept.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={accept} loading={state.accepting} disabled>
              Accept invitation
            </Button>
            <Link href="/login" className="inline-flex h-10 items-center rounded-lg border border-border-strong bg-card px-4 text-sm font-medium hover:bg-muted">
              Switch account
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={accept} loading={state.accepting}>
            Accept invitation
          </Button>
          <Link href="/app/dashboard" className="inline-flex h-10 items-center rounded-lg border border-border-strong bg-card px-4 text-sm font-medium hover:bg-muted">
            Go to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
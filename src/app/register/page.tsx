"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/utils";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Create your workspace" subtitle="Loading..." footer={null}>
          <div className="h-10" />
        </AuthShell>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // /register?next=/invite?token=XXXX — carries the pending invitation into the request.
  const next = searchParams.get("next");
  const nextUrl = next ? new URL(next, "http://localhost") : null;
  const inviteToken =
    nextUrl?.pathname === "/invite" ? (nextUrl.searchParams.get("token") ?? undefined) : undefined;
  const isInvite = Boolean(inviteToken);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          organizationName: isInvite ? undefined : organizationName,
          ...(inviteToken ? { inviteToken } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Registration failed.");
      }
      router.push(isInvite ? next! : "/app/dashboard");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={isInvite ? "Join your team" : "Create your workspace"}
      subtitle={
        isInvite
          ? "Create a free account to accept the invitation."
          : "Start managing all your social channels in one place — free."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary-600 hover:underline dark:text-primary-400">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <Icon name="alert-circle" size={16} />
            {error}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            required
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon="user"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon="mail"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon="lock"
          />
        </div>
        {!isInvite && (
          <div className="grid gap-1.5">
            <Label htmlFor="org">Workspace name</Label>
            <Input
              id="org"
              required
              placeholder="Acme Studio"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              icon="workspace"
            />
          </div>
        )}
        <Button type="submit" loading={loading} className="mt-2">
          {isInvite ? "Create account & join" : "Create free account"}
        </Button>
        {!isInvite && (
          <p className="text-center text-xs text-muted-foreground">
            Free forever plan · 1 social account · 10 posts/month
          </p>
        )}
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or continue with
        <div className="h-px flex-1 bg-border" />
      </div>

      <SocialLoginButtons next={isInvite ? next ?? undefined : undefined} />
    </AuthShell>
  );
}
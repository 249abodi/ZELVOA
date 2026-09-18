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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Welcome back" subtitle="Loading..." footer={null}>
          <div className="h-10" />
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oauthError = errorParam
    ? OAUTH_ERROR_MESSAGES[errorParam] ?? "Social login failed. Please try again."
    : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Login failed.");
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your workspace to keep your social on schedule."
      footer={
        <>
          New to ZELVOA?{" "}
          <Link href="/register" className="font-medium text-primary-600 hover:underline dark:text-primary-400">
            Create a free account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        {(error || oauthError) && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <Icon name="alert-circle" size={16} />
            {error ?? oauthError}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon="lock"
          />
        </div>
        <Button type="submit" loading={loading} className="mt-2">
          Log in
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or continue with
        <div className="h-px flex-1 bg-border" />
      </div>

      <SocialLoginButtons next={next} />
    </AuthShell>
  );
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "You cancelled the sign-in. Try again or use another method.",
  invalid_state: "This sign-in link is no longer valid. Please try again.",
  missing_code: "The provider did not return a code. Please try again.",
  state_used: "This sign-in link was already used. Please try again.",
  state_expired: "This sign-in link expired. Please try again.",
  oauth_failed: "We couldn’t complete the sign-in. Please try again.",
  oauth_conflict:
    "This account is already linked to a different ZELVOA login. Sign in with the original method first.",
  account_disabled: "This account has been disabled.",
};
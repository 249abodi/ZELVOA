"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ZelvoaLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function AuthShell({
  children,
  title,
  subtitle,
  footer,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(124,99,247,0.14),transparent_60%)]"
      />
      <div className="absolute end-4 top-4 flex items-center gap-1.5">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <Link href="/" className="mb-4 flex items-center justify-center">
        <ZelvoaLogo variant="full" size={36} />
      </Link>
      <p className="mb-8 select-none text-center text-sm font-medium text-brand-muted">
        Create. Schedule. Grow.
      </p>
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}
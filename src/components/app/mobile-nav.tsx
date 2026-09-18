"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { ZelvoaLogo } from "@/components/brand/logo";
import { mainNav, managementNav, type NavItem } from "@/components/app/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Dict } from "@/lib/i18n";

export function MobileNav({ dict }: { dict: Dict }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={dict["menu.open"]}
        className="lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={20} />
      </Button>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="fixed inset-0 bg-brand-background-dark/50"
            onClick={close}
          />
          <div className="fixed inset-y-0 start-0 flex w-72 flex-col bg-card shadow-lg animate-in slide-in-from-left">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Link href="/app/dashboard" className="flex items-center gap-2.5" onClick={close}>
                <ZelvoaLogo variant="compact" size={28} />
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={dict["menu.close"]}
                onClick={close}
              >
                <Icon name="x" size={16} />
              </Button>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
              <MobileSection title={dict["app.manage"]} items={mainNav} onNavigate={close} dict={dict} />
              <MobileSection
                title={dict["app.workspace"]}
                items={managementNav}
                onNavigate={close}
                dict={dict}
              />
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function MobileSection({
  title,
  items,
  onNavigate,
  dict,
}: {
  title: string;
  items: NavItem[];
  onNavigate: () => void;
  dict: Dict;
}) {
  return (
    <div>
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <ul className="grid gap-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon name={item.icon} size={18} />
              {dict[item.labelKey]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
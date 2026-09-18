"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";

interface SocialProviderItem {
  id: string;
  label: string;
}

const PROVIDER_ICON: Record<string, IconName> = {
  GOOGLE: "google",
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  TIKTOK: "tiktok",
  X: "xtwitter",
};

export function SocialLoginButtons({ next }: { next?: string }) {
  const [providers, setProviders] = useState<SocialProviderItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(async () => {
        const res = await fetch("/api/v1/auth/providers");
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { providers?: SocialProviderItem[] } };
        if (!cancelled) setProviders(json.data?.providers ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="grid gap-2">
      {providers.map((p) => {
        const href = `/api/v1/auth/oauth/${p.id.toLowerCase()}`;
        const withNext = next && next !== "/app/dashboard" ? `?next=${encodeURIComponent(next)}` : "";
        return (
          <a
            key={p.id}
            href={`${href}${withNext}`}
            className="flex h-10 items-center justify-center gap-2.5 rounded-lg border border-input bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Icon name={PROVIDER_ICON[p.id] ?? "globe"} size={16} />
            Continue with {p.label}
          </a>
        );
      })}
    </div>
  );
}
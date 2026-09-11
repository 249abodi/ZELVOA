"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";

interface MediaAsset {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  storageKey: string;
  width: number | null;
  height: number | null;
}

const TYPE_ICONS: Record<string, IconName> = {
  IMAGE: "image",
  VIDEO: "video",
  DOCUMENT: "documents",
};

export function PostMediaPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/v1/media?limit=100", { signal: controller.signal });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAssets(data.data.assets ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const toggle = useCallback(
    (id: string) => {
      if (selected.includes(id)) {
        onChange(selected.filter((s) => s !== id));
      } else {
        onChange([...selected, id]);
      }
    },
    [selected, onChange]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-8 text-sm text-muted-foreground">
        <Icon name="spinner" size={16} className="animate-spin" />
        Loading media...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        <Icon name="alert-circle" size={16} />
        Failed to load media library.
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center">
        <Icon name="media" size={22} className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No media in your library yet.{" "}
          <a href="/app/media" className="text-primary-600 underline underline-offset-2 dark:text-primary-400">
            Upload media
          </a>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">
        Attach media{" "}
        {selected.length > 0 && (
          <span className="text-muted-foreground">({selected.length} selected)</span>
        )}
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {assets.map((asset) => {
          const isSelected = selected.includes(asset.id);
          return (
            <button
              key={asset.id}
              type="button"
              title={asset.fileName}
              onClick={() => toggle(asset.id)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border transition-all",
                isSelected
                  ? "border-primary bg-primary-50 dark:bg-primary-900/20"
                  : "border-border hover:border-border-strong hover:bg-muted"
              )}
            >
              <Icon
                name={TYPE_ICONS[asset.type]}
                size={20}
                className="text-muted-foreground"
              />
              <p className="w-full truncate px-1 text-center text-[10px] text-muted-foreground">
                {asset.fileName}
              </p>
              {isSelected && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                  <Icon name="check" size={10} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
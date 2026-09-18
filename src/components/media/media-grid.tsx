"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatBytes, cn } from "@/lib/utils";

interface MediaAsset {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  storageKey: string;
  thumbnailKey: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  tags: string[];
  createdAt: string;
  uploadedBy: { id: string; name: string } | null;
}

const TYPE_ICONS: Record<string, "image" | "video" | "documents"> = {
  IMAGE: "image",
  VIDEO: "video",
  DOCUMENT: "documents",
};

const TYPE_COLORS: Record<string, string> = {
  IMAGE: "bg-accent-100 text-accent-600 dark:bg-accent-600/30 dark:text-accent-400",
  VIDEO: "bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400",
  DOCUMENT: "bg-muted text-muted-foreground",
};

function assetThumbUrl(asset: MediaAsset): string {
  if (asset.type === "IMAGE") return `/api/v1/media/${asset.id}/thumbnail`;
  return `/api/v1/media/${asset.id}/file`;
}

function AssetThumb({ asset, className }: { asset: MediaAsset; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || asset.type === "DOCUMENT") {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          TYPE_COLORS[asset.type],
          className
        )}
      >
        <Icon name={TYPE_ICONS[asset.type]} size={22} />
      </div>
    );
  }
  const src =
    asset.type === "IMAGE" && asset.thumbnailKey
      ? assetThumbUrl(asset)
      : `/api/v1/media/${asset.id}/file`;
  return (
    <Image
      src={src}
      alt={asset.altText ?? asset.fileName}
      fill
      unoptimized
      sizes="240px"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}

export function MediaGrid({
  assets,
  onPreview,
  onDelete,
  viewMode = "grid",
}: {
  assets: MediaAsset[];
  onPreview: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
  viewMode?: "grid" | "list";
}) {
  if (assets.length === 0) return null;

  if (viewMode === "list") {
    return (
      <div className="rounded-xl border border-border bg-card">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onPreview(asset)}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                TYPE_COLORS[asset.type]
              )}
            >
              <Icon name={TYPE_ICONS[asset.type]} size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{asset.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(asset.sizeBytes)} &middot; {asset.type.toLowerCase()}
                {asset.uploadedBy && ` \u00b7 ${asset.uploadedBy.name}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(asset);
              }}
              aria-label="Delete"
            >
              <Icon name="trash" size={15} className="text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {assets.map((asset) => (
        <button
          key={asset.id}
          type="button"
          onClick={() => onPreview(asset)}
          className="group relative flex aspect-square flex-col items-center justify-center rounded-xl border border-border bg-card transition-all hover:border-ring/40 hover:shadow-md overflow-hidden"
        >
          <AssetThumb asset={asset} className="h-full w-full rounded-xl" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-background/90 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Badge variant="secondary" className="text-[10px]">
              {asset.type}
            </Badge>
          </div>
        </button>
      ))}
    </div>
  );
}

export function MediaPreviewModal({
  asset,
  open,
  onClose,
  onDelete,
  onUpdate,
}: {
  asset: MediaAsset | null;
  open: boolean;
  onClose: () => void;
  onDelete: (asset: MediaAsset) => void;
  onUpdate: (id: string, data: { altText?: string; tags?: string[] }) => void;
}) {
  const [altText, setAltText] = useState(asset?.altText ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(asset?.tags ?? []);

  if (!asset) return null;

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t) && tags.length < 20) {
      const newTags = [...tags, t];
      setTags(newTags);
      setTagInput("");
      onUpdate(asset.id, { altText, tags: newTags });
    }
  };

  const removeTag = (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    onUpdate(asset.id, { altText, tags: newTags });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={asset.fileName}
      description={`${asset.type} \u00b7 ${formatBytes(asset.sizeBytes)}${asset.width && asset.height ? ` \u00b7 ${asset.width}x${asset.height}` : ""}`}
      size="lg"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-muted relative">
          {asset.type === "IMAGE" ? (
            <Image
              src={`/api/v1/media/${asset.id}/file`}
              alt={asset.altText ?? asset.fileName}
              fill
              unoptimized
              sizes="400px"
              className="object-contain"
            />
          ) : asset.type === "VIDEO" ? (
            <video
              src={`/api/v1/media/${asset.id}/file`}
              controls
              preload="metadata"
              className="h-full w-full object-contain"
            />
          ) : (
            <Icon name={TYPE_ICONS[asset.type]} size={48} className="text-muted-foreground" />
          )}
        </div>
        <div className="grid gap-4">
          <div>
            <label className="text-sm font-medium">Alt text</label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              onBlur={() => onUpdate(asset.id, { altText, tags })}
              placeholder="Describe this media..."
              className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Tags</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeTag(tag)}
                >
                  {tag} <Icon name="x" size={10} />
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag..."
                className="flex h-8 flex-1 rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              />
              <Button size="sm" onClick={addTag} disabled={!tagInput.trim()}>
                Add
              </Button>
            </div>
          </div>
          <div className="grid gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{asset.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size</span>
              <span className="font-medium">{formatBytes(asset.sizeBytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">MIME</span>
              <span className="font-medium">{asset.mimeType}</span>
            </div>
            {asset.uploadedBy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uploaded by</span>
                <span className="font-medium">{asset.uploadedBy.name}</span>
              </div>
            )}
          </div>
          <Button
            variant="destructive"
            size="sm"
            icon="trash"
            onClick={() => {
              onDelete(asset);
              onClose();
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { MediaGrid, MediaPreviewModal } from "@/components/media/media-grid";
import { MediaUploadModal } from "@/components/media/media-upload-modal";
import { MediaFilters } from "@/components/media/media-filters";
import { useToast } from "@/components/ui/toast";

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

interface ListResponse {
  assets: MediaAsset[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function MediaPage() {
  const { toastSuccess, toastError } = useToast();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const requestKeyRef = useRef(0);

  const loadAssets = useCallback(async (params: {
    page?: number;
    q?: string;
    type?: string;
  }) => {
    const search = new URLSearchParams();
    search.set("page", String(params.page));
    search.set("limit", "24");
    if (params.q) search.set("q", params.q);
    if (params.type) search.set("type", params.type);

    const res = await fetch(`/api/v1/media?${search.toString()}`);
    if (!res.ok) throw new Error("Failed to load media");
    const data = (await res.json()) as { data: ListResponse };
    return data.data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      setError(false);
      try {
        const data = await loadAssets({ page: 1, q, type });
        if (cancelled) return;
        setAssets(data.assets);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
        setPage(1);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAssets, q, type]);

  const handleSearch = useCallback((params: { q: string; type: string }) => {
    setQ(params.q);
    setType(params.type);
  }, []);

  const refetch = useCallback(async () => {
    const key = ++requestKeyRef.current;
    setError(false);
    try {
      const data = await loadAssets({ page, q, type });
      if (requestKeyRef.current !== key) return;
      setAssets(data.assets);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch {
      setError(true);
    }
  }, [loadAssets, page, q, type]);

  const handlePreview = (asset: MediaAsset) => {
    setPreviewAsset(asset);
    setPreviewOpen(true);
  };

  const handleDelete = async (asset: MediaAsset) => {
    if (!window.confirm(`Delete "${asset.fileName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/v1/media/${asset.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toastError("Delete failed", err?.error?.message ?? "Could not delete media.");
        return;
      }
      toastSuccess("Media deleted");
      refetch();
    } catch {
      toastError("Delete failed", "Could not delete media.");
    }
  };

  const handleUpdate = async (
    id: string,
    data: { altText?: string; tags?: string[] }
  ) => {
    try {
      const res = await fetch(`/api/v1/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) return;
      const result = (await res.json()) as { data: MediaAsset };
      setAssets((prev) => prev.map((a) => (a.id === id ? result.data : a)));
    } catch {
      // silent — user will see unchanged state
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Media Library"
        description="Upload, organize, and attach media to your posts."
        icon="media"
        badge={total > 0 ? `${total}` : undefined}
        actions={
          <Button icon="upload" onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        }
      />

      <MediaFilters total={total} onSearch={handleSearch} />

      <div className="flex items-center justify-end gap-1">
        <ViewToggle
          mode={viewMode}
          onChange={setViewMode}
        />
      </div>

      {!loaded ? (
        <LoadingState label="Loading media..." />
      ) : error ? (
        <ErrorState
          title="Failed to load media"
          description="Something went wrong while loading your media library."
          onRetry={() => {
            setLoaded(false);
            refetch().then(() => setLoaded(true)).catch(() => setLoaded(true));
          }}
        />
      ) : assets.length === 0 ? (
        <EmptyState
          icon="media"
          title={q || type ? "No media matches your filters" : "No media yet"}
          description={
            q || type
              ? "Try adjusting your search or filters."
              : "Upload your first image, video, or document to build your library."
          }
          actionLabel={q || type ? undefined : "Upload media"}
          onAction={q || type ? undefined : () => setUploadOpen(true)}
          actionIcon="upload"
        />
      ) : (
        <>
          <MediaGrid
            assets={assets}
            onPreview={handlePreview}
            onDelete={handleDelete}
            viewMode={viewMode}
          />
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={(p) => {
                setPage(p);
                loadAssets({ page: p, q, type })
                  .then((data) => {
                    setAssets(data.assets);
                    setTotal(data.pagination.total);
                    setTotalPages(data.pagination.totalPages);
                  })
                  .catch(() => setError(true));
              }}
            />
          )}
        </>
      )}

      <MediaUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => refetch()}
      />

      <MediaPreviewModal
        asset={previewAsset}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
      />
    </div>
  );
}

function ViewToggle({
  mode,
  onChange,
}: {
  mode: "grid" | "list";
  onChange: (mode: "grid" | "list") => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-0.5">
      {(["grid", "list"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-label={`${m} view`}
          className={`flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors ${
            mode === m ? "bg-card text-foreground shadow-xs" : "hover:text-foreground"
          }`}
        >
          <Icon name={m === "grid" ? "grid" : "documents"} size={15} />
        </button>
      ))}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        icon="chevron-left"
      >
        Prev
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next <Icon name="chevron-right" size={15} />
      </Button>
    </div>
  );
}
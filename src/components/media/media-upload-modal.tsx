"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";

const FILE_TYPE_MAP: Record<string, "IMAGE" | "VIDEO" | "DOCUMENT"> = {
  "image/": "IMAGE",
  "video/": "VIDEO",
  "application/pdf": "DOCUMENT",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument": "DOCUMENT",
  "text/": "DOCUMENT",
};

function detectType(mimeType: string): "IMAGE" | "VIDEO" | "DOCUMENT" {
  for (const [prefix, type] of Object.entries(FILE_TYPE_MAP)) {
    if (mimeType.startsWith(prefix)) return type;
  }
  return "DOCUMENT";
}

export function MediaUploadModal({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles(Array.from(fileList));
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file, file.name));

      const res = await fetch("/api/v1/media", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (res.ok) {
        toastSuccess(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`);
        setFiles([]);
        onUploaded();
        onClose();
      } else {
        toastError("Upload failed", data?.error?.message ?? "No files were uploaded.");
      }
    } catch {
      toastError("Upload failed", "An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload media"
      description="Select images, videos, or documents from your device."
    >
      <div
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragActive
            ? "border-primary bg-primary-50 dark:bg-primary-900/20"
            : "border-border hover:border-border-strong"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon name="upload" size={26} />
        </div>
        <p className="mt-3 text-sm font-medium">Drag and drop files here</p>
        <p className="mt-1 text-xs text-muted-foreground">
          or click to browse your device
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-border">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
            >
              <Icon
                name={TYPE_ICONS[detectType(file.type)]}
                size={16}
                className="text-muted-foreground"
              />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={upload}
          loading={uploading}
          disabled={files.length === 0}
          icon="upload"
        >
          Upload {files.length > 0 && `(${files.length})`}
        </Button>
      </div>
    </Modal>
  );
}

const TYPE_ICONS: Record<string, "image" | "video" | "documents"> = {
  IMAGE: "image",
  VIDEO: "video",
  DOCUMENT: "documents",
};

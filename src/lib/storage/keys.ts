import path from "node:path";
import { randomBytes } from "crypto";

const SAFE_RE = /[^\w.-]/g;

export function sanitizeFileName(input: string): string {
  const base = path.basename(input || "file").replace(/[\x00-\x1f]/g, "");
  const cleaned = base.replace(SAFE_RE, "_").replace(/^_+|_+$/g, "");
  return cleaned || "file";
}

export function sanitizeDirectoryName(input: string): string {
  let cleaned = input.trim().replace(SAFE_RE, "_");
  cleaned = cleaned.replace(/^\.+|\.+$/g, "");
  cleaned = cleaned.replace(/\.\.+/g, "_").replace(/^_+|_+$/g, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return "folder";
  if (cleaned.length > 80) return cleaned.slice(0, 80);
  return cleaned;
}

/** Layout: `<workspace>/media/<yyyy>/<mm>/<id12>-<slug>.<ext>` */
export function buildMediaKey(opts: {
  workspaceId: string;
  originalName: string;
  id: string;
  date?: Date;
}): string {
  const date = opts.date ?? new Date();
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const parsed = path.parse(sanitizeFileName(opts.originalName));
  const ext = parsed.ext || "";
  const slug = parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "file";
  const shortId = opts.id.slice(0, 12);
  return `${opts.workspaceId}/media/${yyyy}/${mm}/${shortId}-${slug}${ext}`;
}

export function buildThumbKey(mediaKey: string): string | null {
  const parts = mediaKey.split("/");
  const last = parts[parts.length - 1];
  if (!last || last.startsWith("thumb-")) return null;
  parts[parts.length - 1] = `thumb-${randomBytes(4).toString("hex")}.jpg`;
  return parts.join("/");
}

export function deriveStorageKey(workspaceId: string, fileName: string, id: string): string {
  return buildMediaKey({ workspaceId, originalName: fileName, id });
}
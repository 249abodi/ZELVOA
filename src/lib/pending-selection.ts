import { encryptSecret, decryptSecret } from "@/lib/crypto";

export const PENDING_SELECTION_TTL_MS = 10 * 60 * 1000;

export interface PendingStoredPage {
  pageId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  accessToken: string;
}

export interface PendingPagePayload {
  scopes: string[];
  isDev: boolean;
  pages: PendingStoredPage[];
}

export class PendingSelectionError extends Error {
  constructor(
    public readonly code:
      | "pending_expired"
      | "pending_unauthorized"
      | "pending_invalid_selection",
    message?: string
  ) {
    super(message ?? code);
    this.name = "PendingSelectionError";
  }
}

export function buildPendingPayload(payload: PendingPagePayload): string {
  return encryptSecret(JSON.stringify(payload));
}

export function parsePendingPayload(encrypted: string): PendingPagePayload {
  const raw = decryptSecret(encrypted);
  const parsed = JSON.parse(raw) as Partial<PendingPagePayload>;
  const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
  for (const page of pages) {
    if (!page || typeof page.pageId !== "string" || typeof page.accessToken !== "string") {
      throw new Error("Pending page payload is malformed.");
    }
  }
  return {
    scopes: Array.isArray(parsed.scopes) ? parsed.scopes : [],
    isDev: parsed.isDev === true,
    pages: pages as PendingStoredPage[],
  };
}

export function selectablePageIds(
  pages: { pageId: string; alreadyConnected: boolean }[]
): string[] {
  return pages.filter((p) => !p.alreadyConnected).map((p) => p.pageId);
}

export function allSelectableSelected(
  selected: ReadonlySet<string>,
  pages: { pageId: string; alreadyConnected: boolean }[]
): boolean {
  const selectable = selectablePageIds(pages);
  if (selectable.length === 0) return false;
  return selectable.every((id) => selected.has(id));
}

export function togglePageSelection(
  selected: ReadonlySet<string>,
  pageId: string
): Set<string> {
  const next = new Set(selected);
  if (next.has(pageId)) next.delete(pageId);
  else next.add(pageId);
  return next;
}

export function selectAllPages(
  pages: { pageId: string; alreadyConnected: boolean }[]
): Set<string> {
  return new Set(selectablePageIds(pages));
}
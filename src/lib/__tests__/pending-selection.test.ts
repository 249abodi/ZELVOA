import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  allSelectableSelected,
  buildPendingPayload,
  parsePendingPayload,
  PENDING_SELECTION_TTL_MS,
  PendingSelectionError,
  selectablePageIds,
  selectAllPages,
  togglePageSelection,
} from "@/lib/pending-selection";

const TEST_ENCRYPTION_KEY = "a".repeat(64);

beforeEach(() => {
  vi.stubEnv("ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const pages = [
  { pageId: "page_1", alreadyConnected: false },
  { pageId: "page_2", alreadyConnected: false },
  { pageId: "page_3", alreadyConnected: true },
];

describe("PendingPageSelection payload", () => {
  test("builds and parses an encrypted payload round-trip", () => {
    const encrypted = buildPendingPayload({
      scopes: ["pages_manage_posts", "pages_show_list"],
      isDev: false,
      pages: [{ pageId: "p1", name: "One", username: null, avatarUrl: null, accessToken: "tok-1" }],
    });
    expect(encrypted).not.toContain("tok-1");
    const parsed = parsePendingPayload(encrypted);
    expect(parsed.scopes).toEqual(["pages_manage_posts", "pages_show_list"]);
    expect(parsed.isDev).toBe(false);
    expect(parsed.pages[0]).toEqual({
      pageId: "p1",
      name: "One",
      username: null,
      avatarUrl: null,
      accessToken: "tok-1",
    });
  });

  test("throws on malformed payload", () => {
    expect(() => parsePendingPayload("not-encrypted")).toThrow();
  });

  test("does not store the access token in plaintext", () => {
    const encrypted = buildPendingPayload({
      scopes: [],
      isDev: false,
      pages: [{ pageId: "p", name: "P", username: null, avatarUrl: null, accessToken: "super-secret" }],
    });
    expect(encrypted).not.toContain("super-secret");
  });

  test("TTL is 10 minutes", () => {
    expect(PENDING_SELECTION_TTL_MS).toBe(10 * 60 * 1000);
  });
});

describe("page selection helpers", () => {
  test("selectablePageIds excludes already-connected pages", () => {
    expect(selectablePageIds(pages)).toEqual(["page_1", "page_2"]);
  });

  test("selectAllPages selects only available pages", () => {
    const all = selectAllPages(pages);
    expect(all.has("page_1")).toBe(true);
    expect(all.has("page_2")).toBe(true);
    expect(all.has("page_3")).toBe(false);
  });

  test("togglePageSelection adds and removes ids without mutating the input", () => {
    const initial = new Set<string>();
    const a = togglePageSelection(initial, "page_1");
    expect(a.has("page_1")).toBe(true);
    expect(initial.has("page_1")).toBe(false);
    const b = togglePageSelection(a, "page_1");
    expect(b.has("page_1")).toBe(false);
  });

  test("allSelectableSelected is true when every available page is selected", () => {
    expect(allSelectableSelected(new Set(["page_1", "page_2"]), pages)).toBe(true);
  });

  test("allSelectableSelected is false when nothing is selected", () => {
    expect(allSelectableSelected(new Set(), pages)).toBe(false);
  });

  test("allSelectableSelected ignores already-connected pages", () => {
    expect(allSelectableSelected(new Set(["page_1", "page_2", "page_3"]), pages)).toBe(true);
  });

  test("allSelectableSelected is false when an already-connected id is the only selection", () => {
    expect(allSelectableSelected(new Set(["page_3"]), pages)).toBe(false);
  });

  test("allSelectableSelected is false when there are no selectable pages", () => {
    expect(allSelectableSelected(new Set(), [{ pageId: "x", alreadyConnected: true }])).toBe(false);
  });

  test("clear-all corresponds to an empty set", () => {
    expect(new Set().size).toBe(0);
    const cleared = new Set<string>();
    expect(allSelectableSelected(cleared, pages)).toBe(false);
  });
});

describe("PendingSelectionError", () => {
  test("carries its code", () => {
    const err = new PendingSelectionError("pending_expired");
    expect(err.code).toBe("pending_expired");
    expect(err.message).toBe("pending_expired");
    expect(err.name).toBe("PendingSelectionError");
  });
});
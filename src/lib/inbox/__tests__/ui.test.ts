import { describe, expect, test } from "vitest";
import {
  CONVERSATION_STATUS_OPTIONS,
  statusOptionLabel,
  isConversationStatus,
  assigneeOptionLabel,
  type ConversationStatusValue,
} from "@/lib/inbox/ui";

const BACKEND_CONVERSATION_STATUSES = ["OPEN", "ASSIGNED", "ARCHIVED"] as const;

describe("CONVERSATION_STATUS_OPTIONS", () => {
  test("exactly mirrors the backend ConversationStatus enum values (no missing, no extra)", () => {
    const optionValues = CONVERSATION_STATUS_OPTIONS.map((o) => o.value);
    expect(optionValues.sort()).toEqual([...BACKEND_CONVERSATION_STATUSES].sort());
  });

  test("every option has a non-empty label", () => {
    for (const o of CONVERSATION_STATUS_OPTIONS) {
      expect(o.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("statusOptionLabel", () => {
  test("returns the human label for every valid status", () => {
    for (const value of BACKEND_CONVERSATION_STATUSES) {
      expect(statusOptionLabel(value as ConversationStatusValue)).toBe(
        CONVERSATION_STATUS_OPTIONS.find((o) => o.value === value)?.label
      );
    }
  });
});

describe("isConversationStatus", () => {
  test("recognizes every valid backend value", () => {
    for (const v of BACKEND_CONVERSATION_STATUSES) {
      expect(isConversationStatus(v)).toBe(true);
    }
  });

  test("rejects unknown strings", () => {
    expect(isConversationStatus("PENDING")).toBe(false);
    expect(isConversationStatus("")).toBe(false);
  });
});

describe("assigneeOptionLabel", () => {
  test("always includes the assignee email", () => {
    const label = assigneeOptionLabel("Alice Johnson", "alice@example.com");
    expect(label).toContain("alice@example.com");
    expect(label).toContain("Alice Johnson");
  });

  test("separates name from email", () => {
    const label = assigneeOptionLabel("Bob", "bob@test.io");
    expect(label.indexOf("Bob")).toBeLessThan(label.indexOf("bob@test.io"));
  });
});
import { describe, expect, test } from "vitest";
import {
  inboxListQuerySchema,
  inboxReplySchema,
  inboxUpdateSchema,
} from "@/lib/validators";

describe("inboxListQuerySchema", () => {
  test("accepts empty query", () => {
    expect(inboxListQuerySchema.parse({}).limit).toBe(25);
  });

  test("parses limit coercion", () => {
    expect(inboxListQuerySchema.parse({ limit: "10" }).limit).toBe(10);
  });

  test("rejects unknown status", () => {
    expect(() => inboxListQuerySchema.parse({ status: "SPAM" })).toThrow();
  });
});

describe("inboxUpdateSchema", () => {
  test("requires at least one field", () => {
    expect(() => inboxUpdateSchema.parse({})).toThrow(/At least one field/);
  });

  test("accepts every backend status value", () => {
    for (const status of ["OPEN", "ASSIGNED", "ARCHIVED"] as const) {
      expect(inboxUpdateSchema.parse({ status }).status).toBe(status);
    }
  });

  test("rejects unknown status values", () => {
    expect(() => inboxUpdateSchema.parse({ status: "SPAM" })).toThrow();
  });

  test("accepts assigneeId for an existing member", () => {
    expect(inboxUpdateSchema.parse({ assigneeId: "user-123" }).assigneeId).toBe("user-123");
  });

  test("accepts assignee unassignment", () => {
    expect(inboxUpdateSchema.parse({ assigneeId: null }).assigneeId).toBeNull();
  });

  test("accepts priority, tags and notes", () => {
    const parsed = inboxUpdateSchema.parse({
      priority: "URGENT",
      tags: ["support", "demo"],
      notes: "Call back next week",
    });
    expect(parsed.priority).toBe("URGENT");
    expect(parsed.tags).toEqual(["support", "demo"]);
  });

  test("rejects too many tags", () => {
    expect(() =>
      inboxUpdateSchema.parse({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })
    ).toThrow();
  });

  test("rejects oversized notes", () => {
    expect(() => inboxUpdateSchema.parse({ notes: "x".repeat(4001) })).toThrow();
  });
});

describe("inboxReplySchema", () => {
  test("trims content", () => {
    expect(inboxReplySchema.parse({ content: "  hello  " }).content).toBe("hello");
  });

  test("rejects empty content", () => {
    expect(() => inboxReplySchema.parse({ content: "   " })).toThrow();
  });
});
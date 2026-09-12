import { describe, expect, test } from "vitest";
import {
  approvalActionSchema,
  approvalSubmitSchema,
  campaignCreateSchema,
  campaignPostSchema,
  campaignUpdateSchema,
} from "@/lib/validators";

describe("campaignCreateSchema", () => {
  test("accepts a minimal valid campaign", () => {
    const parsed = campaignCreateSchema.parse({ name: "Summer launch" });
    expect(parsed.name).toBe("Summer launch");
    expect(parsed.status).toBeUndefined();
  });

  test("accepts complete campaign with dates", () => {
    const parsed = campaignCreateSchema.parse({
      name: "Q3", description: "Quarter 3", goal: "Grow reach",
      startDate: "2026-07-01", endDate: "2026-09-30", status: "ACTIVE",
    });
    expect(parsed.status).toBe("ACTIVE");
  });

  test("rejects empty name", () => {
    expect(() => campaignCreateSchema.parse({ name: "" })).toThrow();
  });

  test("rejects malformed status", () => {
    expect(() => campaignCreateSchema.parse({ name: "X", status: "LIVE" })).toThrow();
  });
});

describe("campaignUpdateSchema", () => {
  test("requires at least one field", () => {
    expect(() => campaignUpdateSchema.parse({})).toThrow(/At least one field/);
  });

  test("accepts partial update", () => {
    expect(campaignUpdateSchema.parse({ status: "PAUSED" }).status).toBe("PAUSED");
  });

  test("rejects bad date format", () => {
    expect(() => campaignUpdateSchema.parse({ endDate: "next month" })).toThrow();
  });
});

describe("campaignPostSchema", () => {
  test("accepts postId", () => {
    expect(campaignPostSchema.parse({ postId: "post-1" }).postId).toBe("post-1");
  });

  test("rejects missing postId", () => {
    expect(() => campaignPostSchema.parse({})).toThrow();
  });
});

describe("approvalSubmitSchema", () => {
  test("accepts postId only", () => {
    expect(approvalSubmitSchema.parse({ postId: "post-1" }).postId).toBe("post-1");
  });

  test("accepts optional comment", () => {
    expect(approvalSubmitSchema.parse({ postId: "p", comment: "please review" }).comment).toBe(
      "please review"
    );
  });

  test("rejects missing postId", () => {
    expect(() => approvalSubmitSchema.parse({})).toThrow();
  });
});

describe("approvalActionSchema", () => {
  test("accepts every valid action", () => {
    for (const action of ["APPROVE", "REQUEST_CHANGES", "REJECT"] as const) {
      expect(approvalActionSchema.parse({ action }).action).toBe(action);
    }
  });

  test("accepts optional comment", () => {
    expect(approvalActionSchema.parse({ action: "REJECT", comment: "links broken" }).comment).toBe(
      "links broken"
    );
  });

  test("rejects an unknown action", () => {
    expect(() => approvalActionSchema.parse({ action: "CANCEL" })).toThrow();
  });
});
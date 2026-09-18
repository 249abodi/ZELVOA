import { describe, it, expect } from "vitest";
import {
  connectAccountSchema,
  callbackQuerySchema,
  updateAccountSchema,
  confirmPageSelectionSchema,
  cancelPendingSchema,
} from "@/lib/validators";

describe("connectAccountSchema", () => {
  it("accepts a valid connect payload", () => {
    const result = connectAccountSchema.safeParse({ platform: "INSTAGRAM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform).toBe("INSTAGRAM");
    }
  });

  it("accepts redirectUri and connectsTo", () => {
    const result = connectAccountSchema.safeParse({
      platform: "TIKTOK",
      redirectUri: "https://app.zlevoa.test/callback",
      connectsTo: "acc_1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown platforms", () => {
    expect(connectAccountSchema.safeParse({ platform: "SNAPCHAT" }).success).toBe(false);
  });

  it("rejects missing platform", () => {
    expect(connectAccountSchema.safeParse({}).success).toBe(false);
  });
});

describe("callbackQuerySchema", () => {
  it("accepts a success callback without code", () => {
    const result = callbackQuerySchema.safeParse({
      platform: "LINKEDIN",
      state: "st-1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts code, state and platform together", () => {
    const result = callbackQuerySchema.safeParse({
      platform: "LINKEDIN",
      state: "st-1",
      code: "abc",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an error callback", () => {
    const result = callbackQuerySchema.safeParse({
      platform: "X",
      state: "st-1",
      error: "access_denied",
      error_description: "User declined.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a callback missing state", () => {
    expect(callbackQuerySchema.safeParse({ platform: "X", code: "abc" }).success).toBe(false);
  });
});

describe("updateAccountSchema", () => {
  it("rejects an empty name", () => {
    expect(updateAccountSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("allows only username to update", () => {
    const result = updateAccountSchema.safeParse({ username: "newhandle" });
    expect(result.success).toBe(true);
  });

  it("allows clearing the username", () => {
    const result = updateAccountSchema.safeParse({ username: null });
    expect(result.success).toBe(true);
  });
});

describe("confirmPageSelectionSchema", () => {
  it("accepts a valid selection", () => {
    const result = confirmPageSelectionSchema.safeParse({
      pendingId: "pp_1",
      selectedPageIds: ["page_1", "page_2"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty selection", () => {
    expect(
      confirmPageSelectionSchema.safeParse({ pendingId: "pp_1", selectedPageIds: [] }).success
    ).toBe(false);
  });

  it("rejects a missing pendingId", () => {
    expect(confirmPageSelectionSchema.safeParse({ selectedPageIds: ["page_1"] }).success).toBe(
      false
    );
  });

  it("rejects duplicate selections", () => {
    expect(
      confirmPageSelectionSchema.safeParse({
        pendingId: "pp_1",
        selectedPageIds: ["page_1", "page_1"],
      }).success
    ).toBe(false);
  });

  it("rejects more than 100 selections", () => {
    expect(
      confirmPageSelectionSchema.safeParse({
        pendingId: "pp_1",
        selectedPageIds: Array.from({ length: 101 }, (_, i) => `page_${i}`),
      }).success
    ).toBe(false);
  });

  it("accepts exactly 100 selections", () => {
    expect(
      confirmPageSelectionSchema.safeParse({
        pendingId: "pp_1",
        selectedPageIds: Array.from({ length: 100 }, (_, i) => `page_${i}`),
      }).success
    ).toBe(true);
  });

  it("rejects non-string selectedPageIds", () => {
    expect(
      confirmPageSelectionSchema.safeParse({ pendingId: "pp_1", selectedPageIds: [1] }).success
    ).toBe(false);
  });
});

describe("cancelPendingSchema", () => {
  it("accepts a pendingId", () => {
    expect(cancelPendingSchema.safeParse({ pendingId: "pp_1" }).success).toBe(true);
  });

  it("rejects a missing pendingId", () => {
    expect(cancelPendingSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a blank pendingId", () => {
    expect(cancelPendingSchema.safeParse({ pendingId: "" }).success).toBe(false);
  });
});
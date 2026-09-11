import { describe, it, expect } from "vitest";
import {
  connectAccountSchema,
  callbackQuerySchema,
  updateAccountSchema,
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
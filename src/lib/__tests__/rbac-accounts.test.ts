import { describe, it, expect } from "vitest";
import { roleHasPermission } from "@/lib/rbac";

describe("RBAC — accounts permissions", () => {
  it("OWNER and ADMIN can manage accounts", () => {
    expect(roleHasPermission("OWNER", "accounts.manage")).toBe(true);
    expect(roleHasPermission("ADMIN", "accounts.manage")).toBe(true);
  });

  it("SOCIAL_MEDIA_MANAGER can manage accounts", () => {
    expect(roleHasPermission("SOCIAL_MEDIA_MANAGER", "accounts.manage")).toBe(true);
  });

  it("VIEWER and DESIGNER cannot manage accounts", () => {
    expect(roleHasPermission("VIEWER", "accounts.manage")).toBe(false);
    expect(roleHasPermission("DESIGNER", "accounts.manage")).toBe(false);
  });

  it("VIEWER can view accounts", () => {
    expect(roleHasPermission("VIEWER", "accounts.view")).toBe(false);
  });

  it("CONTENT_MANAGER can view but not manage accounts", () => {
    expect(roleHasPermission("CONTENT_MANAGER", "accounts.view")).toBe(true);
    expect(roleHasPermission("CONTENT_MANAGER", "accounts.manage")).toBe(false);
  });
});
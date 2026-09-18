import { describe, expect, it } from "vitest";
import { canAccessAdmin, isAdminEmail } from "@/lib/admin";

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;
const ORIGINAL_DISABLE_ADMIN = process.env.DISABLE_ADMIN;

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("isAdminEmail", () => {
  it("returns false without an allowlist", () => {
    setEnv("ADMIN_EMAILS", "");
    expect(isAdminEmail("root@zelvoa.com")).toBe(false);
  });

  it("matches an allowlisted email case-insensitively", () => {
    setEnv("ADMIN_EMAILS", "Admin@zelvoa.com, ops@zelvoa.com");
    expect(isAdminEmail("admin@ZELVOA.COM")).toBe(true);
    expect(isAdminEmail("ops@zelvoa.com")).toBe(true);
    expect(isAdminEmail("other@zelvoa.com")).toBe(false);
  });

  it("returns false for null or undefined", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});

describe("canAccessAdmin", () => {
  it("denies OWNER without an allowlisted email", () => {
    setEnv("ADMIN_EMAILS", "");
    setEnv("DISABLE_ADMIN", "");
    expect(canAccessAdmin({ role: "OWNER", email: "owner@example.com" })).toBe(false);
  });

  it("denies non-owner without an allowlisted email", () => {
    setEnv("ADMIN_EMAILS", "");
    setEnv("DISABLE_ADMIN", "");
    expect(canAccessAdmin({ role: "ADMIN", email: "admin@example.com" })).toBe(false);
    expect(canAccessAdmin({ role: null, email: null })).toBe(false);
  });

  it("grants access to an allowlisted email regardless of role", () => {
    setEnv("ADMIN_EMAILS", "root@zelvoa.com");
    setEnv("DISABLE_ADMIN", "");
    expect(canAccessAdmin({ role: "VIEWER", email: "ROOT@zelvoa.com" })).toBe(true);
  });

  it("is fully disabled when DISABLE_ADMIN is true", () => {
    setEnv("ADMIN_EMAILS", "root@zelvoa.com");
    setEnv("DISABLE_ADMIN", "true");
    expect(canAccessAdmin({ role: "OWNER", email: "root@zelvoa.com" })).toBe(false);
  });
});

setEnv("ADMIN_EMAILS", ORIGINAL_ADMIN_EMAILS);
setEnv("DISABLE_ADMIN", ORIGINAL_DISABLE_ADMIN);
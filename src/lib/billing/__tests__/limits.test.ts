import { describe, expect, test } from "vitest";
import { evaluateLimits, planLimitsFor, maskLicenseKey } from "@/lib/billing/limits";

const plan = { maxSocialAccounts: 5, maxPostsPerMonth: 100, maxTeamMembers: 3, maxWorkspaces: 1 };

describe("planLimitsFor", () => {
  test("projects the four plan limits", () => {
    expect(planLimitsFor(plan)).toEqual(plan);
  });
});

describe("evaluateLimits", () => {
  const usage = {
    socialAccounts: 2,
    postsThisMonth: 40,
    teamMembers: 2,
    workspaces: 1,
  };

  test("is ok when usage is within limits", () => {
    const check = evaluateLimits(planLimitsFor(plan), usage);
    expect(check.ok).toBe(true);
    expect(check.exceeded).toEqual([]);
  });

  test("reports social accounts exceeded", () => {
    const check = evaluateLimits(planLimitsFor(plan), { ...usage, socialAccounts: 8 });
    expect(check.ok).toBe(false);
    expect(check.exceeded).toContain("maxSocialAccounts");
  });

  test("reports posts exceeded", () => {
    const check = evaluateLimits(planLimitsFor(plan), { ...usage, postsThisMonth: 150 });
    expect(check.exceeded).toContain("maxPostsPerMonth");
  });

  test("reports team members exceeded", () => {
    const check = evaluateLimits(planLimitsFor(plan), { ...usage, teamMembers: 9 });
    expect(check.exceeded).toContain("maxTeamMembers");
  });

  test("reports multiple limits at once", () => {
    const check = evaluateLimits(planLimitsFor(plan), {
      socialAccounts: 10,
      postsThisMonth: 500,
      teamMembers: 4,
      workspaces: 2,
    });
    expect(check.exceeded).toContain("maxSocialAccounts");
    expect(check.exceeded).toContain("maxPostsPerMonth");
    expect(check.exceeded).toContain("maxTeamMembers");
    expect(check.exceeded).toContain("maxWorkspaces");
  });
});

describe("maskLicenseKey", () => {
  test("always hides every segment", () => {
    expect(maskLicenseKey("ZELVOA-AB2C-D3EF-G4HJ")).toBe("ZELVOA-••••-••••-••••");
  });

  test("falls back for malformed keys", () => {
    expect(maskLicenseKey("nope")).toBe("••••");
  });
});
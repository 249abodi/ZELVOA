import { describe, expect, test } from "vitest";
import { generateDevSnapshots } from "@/lib/analytics/dev-data";

const from = new Date("2026-01-01T00:00:00Z");
const to = new Date("2026-01-10T23:59:59Z");

describe("generateDevSnapshots", () => {
  test("returns one snapshot per day, capped at now", () => {
    const snaps = generateDevSnapshots({
      workspaceId: "ws-1",
      accountId: "acc-1",
      platform: "INSTAGRAM",
      from,
      to,
    });
    expect(snaps.length).toBeGreaterThanOrEqual(1);
    expect(snaps.length).toBeLessThanOrEqual(10);
    for (const s of snaps) {
      expect(s.periodStart <= s.periodEnd).toBe(true);
    }
  });

  test("is deterministic for the same inputs", () => {
    const a = generateDevSnapshots({
      workspaceId: "ws-1",
      accountId: "acc-1",
      platform: "INSTAGRAM",
      from,
      to,
      baseFollowers: 500,
    });
    const b = generateDevSnapshots({
      workspaceId: "ws-1",
      accountId: "acc-1",
      platform: "INSTAGRAM",
      from,
      to,
      baseFollowers: 500,
    });
    expect(a).toEqual(b);
  });

  test("differs across workspaces/accounts", () => {
    const a = generateDevSnapshots({
      workspaceId: "ws-1",
      accountId: "acc-1",
      platform: "INSTAGRAM",
      from,
      to,
    });
    const b = generateDevSnapshots({
      workspaceId: "ws-2",
      accountId: "acc-2",
      platform: "INSTAGRAM",
      from,
      to,
    });
    expect(a[0].reach).not.toBe(b[0].reach);
  });

  test("metrics are non-negative and internal-consistent", () => {
    const snaps = generateDevSnapshots({
      workspaceId: "ws-1",
      accountId: "acc-1",
      platform: "TIKTOK",
      from,
      to,
    });
    for (const s of snaps) {
      expect(s.followers).toBeGreaterThanOrEqual(0);
      expect(s.reach).toBeGreaterThanOrEqual(0);
      expect(s.impressions).toBeGreaterThanOrEqual(0);
      expect(s.engagement).toBeGreaterThanOrEqual(0);
      expect(s.likes + s.comments + s.shares + s.saves + s.clicks).toBeLessThanOrEqual(
        s.engagement * 2 + 100
      );
      expect(s.platform).toBe("TIKTOK");
      expect(s.socialAccountId).toBe("acc-1");
    }
  });

  test("followers stay monotonic within a campaign period", () => {
    const snaps = generateDevSnapshots({
      workspaceId: "ws-1",
      accountId: "acc-1",
      platform: "LINKEDIN",
      from,
      to,
      baseFollowers: 1000,
    });
    for (let i = 1; i < snaps.length; i++) {
      expect(snaps[i].followers).toBeGreaterThanOrEqual(snaps[i - 1].followers);
    }
  });

  test("period boundaries are day-aligned", () => {
    const snaps = generateDevSnapshots({
      workspaceId: "ws-1",
      accountId: "acc-1",
      platform: "X",
      from,
      to,
    });
    for (const s of snaps) {
      expect(s.periodStart.getUTCHours()).toBe(0);
      expect(s.periodEnd.getUTCHours()).toBe(23);
      expect(s.periodStart.getUTCMinutes()).toBe(0);
    }
  });
});
import { describe, expect, test } from "vitest";
import {
  describeInboxSupport,
  devInboundForAccount,
  type InboxAccount,
} from "@/lib/inbox/source";

const devAccount: InboxAccount = {
  id: "acc-dev",
  platform: "INSTAGRAM",
  scopes: ["zelvoa:dev"],
  providerName: "Instagram (Development)",
  providerUsername: "dev_1",
};

const realAccount: InboxAccount = {
  id: "acc-real",
  platform: "X",
  scopes: ["profile", "read"],
  providerName: "X",
  providerUsername: "brand",
};

describe("describeInboxSupport", () => {
  test("dev accounts are supported", () => {
    expect(describeInboxSupport(devAccount)).toEqual({ supported: true, reason: null });
  });

  test("accounts with inbox import scope are supported", () => {
    expect(
      describeInboxSupport({ ...realAccount, scopes: ["zelvoa:inbox-import"] })
    ).toEqual({ supported: true, reason: expect.stringContaining("inbox import") });
  });

  test("plain real accounts are unsupported with an honest reason", () => {
    const r = describeInboxSupport(realAccount);
    expect(r.supported).toBe(false);
    expect(r.reason).toContain("development account");
  });
});

describe("devInboundForAccount", () => {
  test("returns nothing for non-dev accounts", () => {
    expect(devInboundForAccount(realAccount, new Date("2026-01-01T12:00:00Z"))).toEqual([]);
  });

  test("returns a scripted message for dev accounts", () => {
    const msgs = devInboundForAccount(devAccount, new Date("2026-01-01T12:00:00Z"));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].conversationId).toBe("dev-acc-dev");
    expect(msgs[0].contactName).toMatch(/Dev Visitor/);
    expect(msgs[0].platform).toBe("INSTAGRAM");
    expect(msgs[0].content.length).toBeGreaterThan(10);
  });

  test("is deterministic for the same time bucket", () => {
    const t = new Date("2026-02-01T08:30:00Z");
    const a = devInboundForAccount(devAccount, t);
    const b = devInboundForAccount(devAccount, t);
    expect(a[0].content).toBe(b[0].content);
    expect(a[0].contactName).toBe(b[0].contactName);
  });

  test("keeps unique message ids", () => {
    const t = new Date("2026-02-01T08:30:00Z");
    const [msg] = devInboundForAccount(devAccount, t);
    expect(msg.messageId.startsWith("dev-")).toBe(true);
  });
});
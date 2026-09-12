import { describe, it, expect } from "vitest";
import { accountRecordFromExchange } from "@/lib/integrations/types";
import { OAuth2SocialProvider } from "@/lib/integrations/oauth-provider";
import type { ExchangedToken } from "@/lib/integrations/types";

describe("accountRecordFromExchange", () => {
  it("projects the exchanged token into a single-account record without raw data", () => {
    const exchanged: ExchangedToken = {
      accessToken: "tok12345",
      refreshToken: "ref12345",
      expiresInSeconds: 3600,
      scopes: ["publish"],
      platformAccountId: "acc_1",
      name: "Test Account",
      username: "test",
      avatarUrl: "https://img/x.png",
      raw: { secret_field: "should not propagate" },
    };
    const record = accountRecordFromExchange(exchanged, "X");
    expect(record.platform).toBe("X");
    expect(record.platformAccountId).toBe("acc_1");
    expect(record.token?.accessToken).toBe("tok12345");
    expect(record.token).not.toHaveProperty("raw");
    expect(record.status).toBe("CONNECTED");
    expect((record.token as { raw?: unknown }).raw).toBeUndefined();
  });
});

describe("default getAccounts", () => {
  it("returns a single account derived from the exchange for generic providers", async () => {
    const provider = new OAuth2SocialProvider("X");
    const records = await provider.getAccounts({
      accessToken: "t",
      platformAccountId: "id1",
      name: "X account",
    });
    expect(records).toHaveLength(1);
    expect(records[0].platformAccountId).toBe("id1");
  });

  it("throws NOT_IMPLEMENTED for publishing on the generic provider", async () => {
    const provider = new OAuth2SocialProvider("X");
    await expect(
      provider.publish({ accessToken: "t", platformAccountId: "id1", content: "hi", postType: "STANDARD" })
    ).rejects.toThrow(/not implemented/i);
  });
});
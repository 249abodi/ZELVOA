import { describe, it, expect } from "vitest";
import { DevSocialProvider, markDev, isDevMarkerScope } from "@/lib/integrations/dev-provider";

describe("DevSocialProvider", () => {
  it("always flags itself as a development provider", () => {
    const provider = new DevSocialProvider("INSTAGRAM");
    expect(provider.isDevProvider).toBe(true);
    expect(provider.configured).toBe(false);
  });

  it("builds a self-callback authorization URL with the state", () => {
    const provider = new DevSocialProvider("TIKTOK");
    const url = provider.buildAuthorizationUrl({
      state: "st-1",
      redirectUri: "http://localhost:3000/cb",
    });
    expect(url).toContain("state=st-1");
    expect(url).toContain("code=dev-");
    expect(url).toContain("platform=TIKTOK");
  });

  it("rejects non-dev codes on exchange", async () => {
    const provider = new DevSocialProvider("INSTAGRAM");
    await expect(provider.exchangeCode("real-code-123")).rejects.toThrow(
      /Invalid development authorization code/
    );
  });

  it("exchanges a dev code into a marked dev account", async () => {
    const provider = new DevSocialProvider("LINKEDIN");
    const token = await provider.exchangeCode("dev-abc123");
    expect(token.accessToken).toContain("dev-access-");
    expect(isDevMarkerScope(token.scopes ?? [])).toBe(true);
    expect(token.name).toContain("(Development)");
    expect(token.platformAccountId.startsWith("dev-")).toBe(true);
  });

  it("marks scopes with the dev sentinel without duplicating", () => {
    const scopes = markDev(["public_profile", "zelvoa:dev"]);
    expect(scopes.filter((s) => s === "zelvoa:dev")).toHaveLength(1);
  });
});

describe("markDev/isDevMarkerScope", () => {
  it("round-trips the sentinel", () => {
    const marked = markDev(["a"]);
    expect(isDevMarkerScope(marked)).toBe(true);
    expect(isDevMarkerScope(["a"])).toBe(false);
  });
});
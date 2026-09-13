import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FacebookProvider, InstagramProvider } from "@/lib/integrations/providers/meta";
import { getRegistryEntry } from "@/lib/integrations/registry";
import type { ExchangedToken, PublishInput } from "@/lib/integrations/types";
import { PublishingError } from "@/lib/publishing/errors";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(responses: Array<() => Response>) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: { toString(): string }) => {
    calls.push(String(input));
    const next = responses.shift();
    if (!next) {
      return json({ error: { message: `unexpected call ${String(input)}`, code: 1 } }, 400);
    }
    return next();
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

beforeEach(() => {
  vi.stubEnv("FACEBOOK_CLIENT_ID", "fb-id");
  vi.stubEnv("FACEBOOK_CLIENT_SECRET", "fb-secret");
  vi.stubEnv("INSTAGRAM_CLIENT_ID", "");
  vi.stubEnv("INSTAGRAM_CLIENT_SECRET", "");
  vi.stubEnv("ALLOW_DEV_PROVIDERS", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("unified Meta app credentials", () => {
  it("treats Instagram as configured when only the Meta app credentials exist", () => {
    const entry = getRegistryEntry("INSTAGRAM");
    expect(entry.configured).toBe(true);
    expect(entry.devMode).toBe(false);
  });

  it("falls back to Instagram-specific credentials when Meta app vars are absent", () => {
    vi.stubEnv("FACEBOOK_CLIENT_ID", "");
    vi.stubEnv("FACEBOOK_CLIENT_SECRET", "");
    vi.stubEnv("INSTAGRAM_CLIENT_ID", "ig-id");
    vi.stubEnv("INSTAGRAM_CLIENT_SECRET", "ig-secret");
    expect(getRegistryEntry("INSTAGRAM").configured).toBe(true);
  });

  it("keeps Instagram unconfigured when neither credential pair exists", () => {
    vi.stubEnv("FACEBOOK_CLIENT_ID", "");
    vi.stubEnv("FACEBOOK_CLIENT_SECRET", "");
    const entry = getRegistryEntry("INSTAGRAM");
    expect(entry.configured).toBe(false);
    expect(entry.reason).toContain("FACEBOOK_CLIENT_ID");
  });
});

describe("Instagram authorization through Facebook Login", () => {
  it("builds an authorization URL against the Meta app with IG scopes", () => {
    const provider = new InstagramProvider();
    const url = new URL(
      provider.buildAuthorizationUrl({ state: "st123", redirectUri: "https://app/cb" })
    );
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v25.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("fb-id");
    expect(url.searchParams.get("state")).toBe("st123");
    expect(url.searchParams.get("scope")).toContain("instagram_content_publish");
    expect(url.searchParams.get("scope")).toContain("instagram_basic");
    expect(url.searchParams.get("scope")).toContain("pages_show_list");
  });

  it("exchanges the code for a long-lived user token via fb_exchange_token", async () => {
    const { calls } = mockFetch([
      () =>
        json({
          access_token: "short-lived",
          token_type: "bearer",
          expires_in: 5400,
        }),
      () =>
        json({
          access_token: "long-lived-user-token",
          token_type: "bearer",
          expires_in: 5184000,
        }),
    ]);

    const provider = new InstagramProvider();
    const result = await provider.exchangeCode(
      "auth-code",
      "https://app/cb"
    );

    expect(result.accessToken).toBe("long-lived-user-token");
    expect(result.expiresInSeconds).toBe(5184000);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("grant_type=fb_exchange_token");
    expect(calls[1]).toContain("client_id=fb-id");
    expect(calls[1]).toContain("fb_exchange_token=short-lived");
  });
});

describe("Instagram account discovery", () => {
  it("resolves pages to their Instagram Business accounts using the user token", async () => {
    const exchanged: ExchangedToken = {
      accessToken: "long-lived-user-token",
      expiresInSeconds: 5184000,
      scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
      platformAccountId: "ig1",
      name: "placeholder",
    };
    const { calls } = mockFetch([
      () =>
        json({
          data: [
            { id: "page1", name: "Page One" },
            { id: "page2", name: "Page Two" },
          ],
        }),
      () =>
        json({
          data: [
            {
              id: "ig1",
              username: "igone",
              name: "IG One",
              profile_picture_url: "https://img/ig1.png",
            },
          ],
        }),
      () => json({ data: [] }),
    ]);

    const provider = new InstagramProvider();
    const records = await provider.getAccounts(exchanged);

    expect(records).toHaveLength(1);
    expect(records[0].platformAccountId).toBe("ig1");
    expect(records[0].name).toBe("IG One");
    expect(records[0].username).toBe("igone");
    expect(records[0].avatarUrl).toBe("https://img/ig1.png");
    expect(records[0].status).toBe("CONNECTED");
    expect(records[0].token?.accessToken).toBe("long-lived-user-token");
    expect((records[0].token as { raw?: unknown }).raw).toBeUndefined();
    expect(calls[1]).toContain("page1/instagram_accounts");
    expect(calls[2]).toContain("page2/instagram_accounts");
  });

  it("throws a clear error when no Instagram Business account is discovered", async () => {
    const exchanged: ExchangedToken = {
      accessToken: "long-lived-user-token",
      scopes: ["instagram_content_publish"],
      platformAccountId: "ig",
      name: "placeholder",
    };
    mockFetch([
      () => json({ data: [{ id: "page1", name: "Page One" }] }),
      () => json({ data: [] }),
    ]);

    const provider = new InstagramProvider();
    await expect(provider.getAccounts(exchanged)).rejects.toMatchObject({
      code: "PROVIDER_PERMISSION",
    });
  });

  it("refreshes the long-lived token through graph.instagram.com", async () => {
    const { calls } = mockFetch([
      () => json({ access_token: "refreshed-token", expires_in: 600 }),
    ]);
    const provider = new InstagramProvider();
    const result = await provider.refresh("old-long-lived-token");

    expect(result.accessToken).toBe("refreshed-token");
    expect(result.expiresInSeconds).toBe(600);
    expect(calls[0]).toContain("https://graph.instagram.com/refresh_access_token");
    expect(calls[0]).toContain("grant_type=ig_refresh_token");
  });
});

describe("Facebook account discovery", () => {
  it("expands the profile into one record per page with a page-scoped token", async () => {
    const { calls } = mockFetch([
      () =>
        json({
          data: [
            {
              id: "page1",
              name: "ZELVOA",
              username: "zelvoa",
              link: "https://facebook.com/zelvoa",
              picture: { data: { url: "https://img/page1.png" } },
              access_token: "page-token-1",
            },
          ],
        }),
    ]);

    const provider = new FacebookProvider();
    const records = await provider.getAccounts({
      accessToken: "user-token",
      scopes: ["pages_manage_posts", "pages_read_engagement"],
      platformAccountId: "user",
      name: "User",
    });

    expect(records).toHaveLength(1);
    expect(records[0].platformAccountId).toBe("page1");
    expect(records[0].name).toBe("ZELVOA");
    expect(records[0].token?.accessToken).toBe("page-token-1");
    expect(calls[0]).toContain("me/accounts");
  });

  it("throws when the profile manages no pages", async () => {
    mockFetch([() => json({ data: [] })]);
    const provider = new FacebookProvider();
    await expect(
      provider.getAccounts({
        accessToken: "user-token",
        platformAccountId: "user",
        name: "User",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_PERMISSION" });
  });
});

describe("Meta publish", () => {
  function input(overrides: Partial<PublishInput> = {}): PublishInput {
    return {
      accessToken: "account-token",
      platformAccountId: "page1",
      content: "Hello world",
      postType: "STANDARD",
      ...overrides,
    };
  }

  it("publishes a text feed post", async () => {
    const { calls } = mockFetch([() => json({ id: "feed_1", created_time: "2026-01-01T00:00:00Z" })]);
    const provider = new FacebookProvider();
    const result = await provider.publish(input());
    expect(result.providerPostId).toBe("feed_1");
    expect(calls[0]).toContain("page1/feed");
  });

  it("publishes a single photo", async () => {
    mockFetch([() => json({ id: "photo_1" })]);
    const provider = new FacebookProvider();
    const result = await provider.publish(
      input({ media: [{ url: "https://img/a.png", mimeType: "image/png", type: "IMAGE" }] })
    );
    expect(result.providerPostId).toBe("photo_1");
  });

  it("rejects videos inside a multi-photo post", async () => {
    mockFetch([() => json({ id: "container_1" })]);
    const provider = new FacebookProvider();
    await expect(
      provider.publish(
        input({
          media: [
            { url: "https://img/a.png", mimeType: "image/png", type: "IMAGE" },
            { url: "https://img/b.mp4", mimeType: "video/mp4", type: "VIDEO" },
          ],
        })
      )
    ).rejects.toMatchObject({ code: "MEDIA_INVALID" });
  });
});

describe("Meta error mapping", () => {
  it.each([
    [4, undefined, "PROVIDER_RATE_LIMITED"],
    [190, "OAuthException", "AUTH_EXPIRED"],
    [200, "OAuthException", "PROVIDER_PERMISSION"],
    [10, "OAuthException", "PROVIDER_PERMISSION"],
    [506, undefined, "PROVIDER_DUPLICATE"],
  ] as const)(
    "maps Meta code %s to %s",
    async (code, type, expected) => {
      mockFetch([
        () =>
          json(
            {
              error: { message: "mapped", code, ...(type ? { type } : {}) },
            },
            400
          ),
      ]);
      const provider = new FacebookProvider();
      try {
        await provider.publish({
          accessToken: "account-token",
          platformAccountId: "page1",
          content: "Hello world",
          postType: "STANDARD",
        });
        expect.unreachable("expected publish to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(PublishingError);
        expect((error as PublishingError).code).toBe(expected);
      }
    }
  );

  it("throws AUTH_EXPIRED when Instagram refresh returns a graph.instagram.com error", async () => {
    mockFetch([
      () =>
        json(
          {
            error: { message: "token expired", code: 190, type: "OAuthException" },
          },
          400
        ),
    ]);
    const provider = new InstagramProvider();
    await expect(provider.refresh("stale-token")).rejects.toMatchObject({
      code: "AUTH_EXPIRED",
    });
  });
});
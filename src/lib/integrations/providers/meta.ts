import { getProviderCredentials } from "@/lib/integrations/registry";
import { OAuth2SocialProvider } from "@/lib/integrations/oauth-provider";
import type {
  ExchangedToken,
  ProviderAccountRecord,
  PublishInput,
  PublishResult,
  PublishingStatusResult,
  RefreshResult,
} from "@/lib/integrations/types";
import { PublishingError } from "@/lib/publishing/errors";

const GRAPH = "https://graph.facebook.com/v25.0";

interface MetaErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
}

function metaError(body: MetaErrorBody, retryable: boolean, stage: "PROVIDER_PUBLISH" | "PROVIDER_AUTH") {
  const message = body?.error?.message ?? "Meta returned an error.";
  const code = body?.error?.code;
  let mapped: "PROVIDER_RATE_LIMITED" | "PROVIDER_PERMISSION" | "PROVIDER_DUPLICATE" | "PROVIDER_ERROR" | "AUTH_EXPIRED" = "PROVIDER_ERROR";
  if (code === 4 || (code === 17 && retryable)) mapped = "PROVIDER_RATE_LIMITED";
  else if (code === 190 || code === 2500) mapped = "AUTH_EXPIRED";
  else if (body?.error?.type === "OAuthException" && code === 200) mapped = "PROVIDER_PERMISSION";
  else if (code === 506) mapped = "PROVIDER_DUPLICATE";
  else if (code === 10) mapped = "PROVIDER_PERMISSION";
  throw new PublishingError({
    code: mapped,
    stage,
    message,
    retryable,
  });
}

async function metaGraph(
  path: string,
  params: Record<string, string>,
  retryable = true,
  stage: "PROVIDER_PUBLISH" | "PROVIDER_AUTH" = "PROVIDER_PUBLISH"
): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as MetaErrorBody;
    metaError(body, retryable, stage);
  }
  const body = (await res.json()) as Record<string, unknown>;
  if ((body as MetaErrorBody).error) {
    metaError(body as MetaErrorBody, retryable, stage);
  }
  return body;
}

async function metaPost(
  path: string,
  params: Record<string, string>,
  retryable = true,
  stage: "PROVIDER_PUBLISH" | "PROVIDER_AUTH" = "PROVIDER_PUBLISH"
): Promise<Record<string, unknown>> {
  const url = `${GRAPH}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as MetaErrorBody;
    metaError(body, retryable, stage);
  }
  const body = (await res.json()) as Record<string, unknown>;
  if ((body as MetaErrorBody).error) {
    metaError(body as MetaErrorBody, retryable, stage);
  }
  return body;
}

/**
 * Facebook Page publishing via the Graph API. A connected Facebook profile is
 * expanded into one account per page the user administers. Each account stores
 * its own page-scoped token.
 */
export class FacebookProvider extends OAuth2SocialProvider {
  constructor() {
    super("FACEBOOK");
  }

  override async getAccounts(exchanged: ExchangedToken): Promise<ProviderAccountRecord[]> {
    const pages = (await metaGraph(
      "me/accounts",
      {
        access_token: exchanged.accessToken,
        fields: "id,name,username,link,picture.type(large),access_token",
        limit: "100",
      },
      true,
      "PROVIDER_AUTH"
    )) as { data?: Array<Record<string, unknown>> };

    const list = Array.isArray(pages?.data) ? pages.data : [];
    const records: ProviderAccountRecord[] = list.map((page) => {
      const pageId = String(page.id ?? "");
      const pageToken = String(page.access_token ?? "");
      const picture =
        (page.picture as { data?: { url?: string } })?.data?.url ?? null;
      return {
        platform: "FACEBOOK",
        platformAccountId: pageId,
        name: String(page.name ?? "Facebook Page"),
        username: (page.username as string) ?? null,
        avatarUrl: picture,
        scopes: exchanged.scopes ?? [],
        status: "CONNECTED",
        token: {
          accessToken: pageToken || exchanged.accessToken,
          refreshToken: undefined,
          expiresInSeconds: null,
          scopes: exchanged.scopes ?? [],
          platformAccountId: pageId,
          name: String(page.name ?? "Facebook Page"),
          username: (page.username as string) ?? null,
          avatarUrl: picture,
        },
        isDevProvider: false,
      };
    });

    if (records.length === 0) {
      throw new PublishingError({
        code: "PROVIDER_PERMISSION",
        stage: "PROVIDER_AUTH",
        message: "The connected Facebook account does not manage any pages.",
        retryable: false,
      });
    }
    return records;
  }

  override async refresh(accessToken: string): Promise<RefreshResult> {
    const creds = this.getCredentials();
    if (!creds) {
      throw new PublishingError({
        code: "NOT_CONFIGURED",
        stage: "PROVIDER_AUTH",
        message: "Facebook client credentials are not configured.",
        retryable: false,
      });
    }
    const body = (await metaGraph(
      "oauth/access_token",
      {
        grant_type: "fb_exchange_token",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        fb_exchange_token: accessToken,
      },
      true,
      "PROVIDER_AUTH"
    )) as { access_token?: string; expires_in?: number };
    if (!body.access_token) {
      throw new PublishingError({
        code: "AUTH_EXPIRED",
        stage: "PROVIDER_AUTH",
        message: "Facebook could not refresh the access token.",
        retryable: false,
      });
    }
    return {
      accessToken: body.access_token,
      expiresInSeconds: typeof body.expires_in === "number" ? body.expires_in : null,
    };
  }

  override async publish(input: PublishInput): Promise<PublishResult> {
    if (input.media && input.media.length > 1) {
      return this.publishMultiPhoto(input);
    }
    if (input.media && input.media.length === 1) {
      const media = input.media[0];
      if (media.type === "VIDEO") {
        throw new PublishingError({
          code: "MEDIA_INVALID",
          stage: "PROVIDER_PUBLISH",
          message: "Facebook video publishing requires the video upload API.",
          retryable: false,
        });
      }
      const result = (await metaPost(
        `${input.platformAccountId}/photos`,
        { url: media.url, caption: input.content, access_token: input.accessToken },
        true,
        "PROVIDER_PUBLISH"
      )) as { id?: string };
      return {
        providerPostId: String(result.id ?? ""),
        url: `https://www.facebook.com/${input.platformAccountId}/posts/${String(result.id ?? "")}`,
        publishedAt: new Date().toISOString(),
        raw: result,
      };
    }
    const result = (await metaPost(
      `${input.platformAccountId}/feed`,
      { message: input.content, access_token: input.accessToken },
      true,
      "PROVIDER_PUBLISH"
    )) as { id?: string };
    return {
      providerPostId: String(result.id ?? ""),
      url: `https://www.facebook.com/${input.platformAccountId}/posts/${String(result.id ?? "")}`,
      publishedAt: new Date().toISOString(),
      raw: result,
    };
  }

  private async publishMultiPhoto(input: PublishInput): Promise<PublishResult> {
    const images = input.media ?? [];
    const children: string[] = [];
    for (const media of images) {
      if (media.type === "VIDEO") {
        throw new PublishingError({
          code: "MEDIA_INVALID",
          stage: "PROVIDER_PUBLISH",
          message: "Multi-photo posts cannot include videos.",
          retryable: false,
        });
      }
      const container = (await metaPost(
        `${input.platformAccountId}/photos`,
        { url: media.url, published: "false", access_token: input.accessToken },
        true,
        "PROVIDER_PUBLISH"
      )) as { id?: string };
      children.push(String(container.id ?? ""));
    }
    const result = (await metaPost(
      `${input.platformAccountId}/feed`,
      { message: input.content, attached_media: JSON.stringify(children.map((c) => ({ media_fbid: c }))), access_token: input.accessToken },
      true,
      "PROVIDER_PUBLISH"
    )) as { id?: string };
    return {
      providerPostId: String(result.id ?? ""),
      url: `https://www.facebook.com/${input.platformAccountId}/posts/${String(result.id ?? "")}`,
      publishedAt: new Date().toISOString(),
      raw: result,
    };
  }

  override async getPublishingStatus(providerPostId: string): Promise<PublishingStatusResult> {
    const body = await metaGraph(providerPostId, { fields: "id,created_time" }, true, "PROVIDER_PUBLISH");
    if (body.id) {
      return { status: "PUBLISHED", url: `https://www.facebook.com/${providerPostId}` };
    }
    return { status: "PENDING" };
  }
}

/**
 * Instagram Business/Creator publishing through Facebook Login.
 *
 * Instagram connects with the same Meta app as Facebook Pages: one
 * authorization + token exchange produces a long-lived user token, then every
 * page the user administers is resolved to its linked Instagram
 * Business/Creator account. Publishing therefore uses the user (not page)
 * token with the instagram_content_publish permission.
 */
export class InstagramProvider extends OAuth2SocialProvider {
  constructor() {
    super("INSTAGRAM");
  }

  /** Instagram connects through the Meta app, so prefer the unified credentials. */
  override getCredentials() {
    return getProviderCredentials("INSTAGRAM");
  }

  override async exchangeCode(code: string, redirectUri: string): Promise<ExchangedToken> {
    const exchanged = await super.exchangeCode(code, redirectUri);
    const creds = this.getCredentials();
    if (!creds) {
      throw new PublishingError({
        code: "NOT_CONFIGURED",
        stage: "PROVIDER_AUTH",
        message: "Instagram client credentials are not configured.",
        retryable: false,
      });
    }
    const long = (await metaGraph(
      "oauth/access_token",
      {
        grant_type: "fb_exchange_token",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        fb_exchange_token: exchanged.accessToken,
      },
      true,
      "PROVIDER_AUTH"
    )) as { access_token?: string; expires_in?: number };
    return {
      accessToken: long?.access_token ?? exchanged.accessToken,
      refreshToken: undefined,
      expiresInSeconds:
        typeof long?.expires_in === "number" ? long.expires_in : 60 * 60 * 24 * 60,
      scopes: exchanged.scopes ?? [],
      platformAccountId: exchanged.platformAccountId,
      name: exchanged.name,
      username: exchanged.username ?? null,
      avatarUrl: null,
      raw: { longLived: true },
    };
  }

  override async getAccounts(exchanged: ExchangedToken): Promise<ProviderAccountRecord[]> {
    const pages = (await metaGraph(
      "me/accounts",
      {
        access_token: exchanged.accessToken,
        fields: "id,name",
        limit: "200",
      },
      true,
      "PROVIDER_AUTH"
    )) as { data?: Array<Record<string, unknown>> };

    const list = Array.isArray(pages?.data) ? pages.data : [];
    const records: ProviderAccountRecord[] = [];

    for (const page of list) {
      const pageId = String(page.id ?? "");
      if (!pageId) continue;
      try {
        const ig = (await metaGraph(
          `${pageId}/instagram_accounts`,
          {
            access_token: exchanged.accessToken,
            fields: "id,username,name,profile_picture_url",
          },
          true,
          "PROVIDER_AUTH"
        )) as { data?: Array<Record<string, unknown>> };
        const nodes = Array.isArray(ig?.data) ? ig.data : [];
        for (const node of nodes) {
          const igId = String(node.id ?? "");
          if (!igId) continue;
          const displayName = String(node.name ?? page.name ?? "Instagram account");
          records.push({
            platform: "INSTAGRAM",
            platformAccountId: igId,
            name: displayName,
            username: (node.username as string) ?? null,
            avatarUrl: (node.profile_picture_url as string) ?? null,
            scopes: exchanged.scopes ?? [],
            status: "CONNECTED",
            token: {
              accessToken: exchanged.accessToken,
              refreshToken: undefined,
              expiresInSeconds: exchanged.expiresInSeconds ?? null,
              scopes: exchanged.scopes ?? [],
              platformAccountId: igId,
              name: displayName,
              username: (node.username as string) ?? null,
              avatarUrl: (node.profile_picture_url as string) ?? null,
            },
            isDevProvider: false,
          });
        }
      } catch {
        // A page that cannot surface its Instagram account is skipped.
      }
    }

    if (records.length === 0) {
      throw new PublishingError({
        code: "PROVIDER_PERMISSION",
        stage: "PROVIDER_AUTH",
        message:
          "The connected Facebook profile is not linked to an Instagram Business or Creator account available for publishing.",
        retryable: false,
      });
    }
    return records;
  }

  override async refresh(accessToken: string): Promise<RefreshResult> {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    let body: { access_token?: string; expires_in?: number };
    if (!res.ok) {
      const raw = (await res.json().catch(() => ({}))) as MetaErrorBody;
      metaError(raw, true, "PROVIDER_AUTH");
      body = {};
    } else {
      body = (await res.json()) as { access_token?: string; expires_in?: number };
      const raw = { error: (body as { error?: { message?: string; code?: number } }).error };
      if (raw.error) {
        metaError(raw as MetaErrorBody, true, "PROVIDER_AUTH");
      }
    }
    if (!body.access_token) {
      throw new PublishingError({
        code: "AUTH_EXPIRED",
        stage: "PROVIDER_AUTH",
        message: "Instagram could not refresh the access token.",
        retryable: false,
      });
    }
    return {
      accessToken: body.access_token,
      expiresInSeconds: typeof body.expires_in === "number" ? body.expires_in : null,
    };
  }

  override async publish(input: PublishInput): Promise<PublishResult> {
    const media = input.media ?? [];
    if (media.length === 0) {
      throw new PublishingError({
        code: "MEDIA_INVALID",
        stage: "PROVIDER_PUBLISH",
        message: "Instagram posts require at least one image or video.",
        retryable: false,
      });
    }
    if (!input.content) {
      throw new PublishingError({
        code: "CONTENT_INVALID",
        stage: "PROVIDER_PUBLISH",
        message: "Instagram requires a caption.",
        retryable: false,
      });
    }
    const userId = input.platformAccountId;

    if (media.length === 1 && input.postType !== "REEL") {
      return this.publishSingle(userId, media[0], input);
    }

    if (media.length === 1) {
      const result = (await metaPost(
        `${userId}/media`,
        {
          media_type: "REELS",
          video_url: media[0].url,
          caption: input.content,
          share_to_feed: "false",
          access_token: input.accessToken,
        },
        true,
        "PROVIDER_PUBLISH"
      )) as { id?: string };
      if (!result.id) {
        throw new PublishingError({
          code: "PROVIDER_ERROR",
          stage: "PROVIDER_PUBLISH",
          message: "Instagram did not return a media container.",
          retryable: true,
        });
      }
      const published = (await metaPost(
        `${userId}/media_publish`,
        { creation_id: String(result.id), access_token: input.accessToken },
        true,
        "PROVIDER_PUBLISH"
      )) as { id?: string };
      return {
        providerPostId: String(published.id ?? result.id),
        url: `https://www.instagram.com/p/${String(published.id ?? result.id)}`,
        publishedAt: new Date().toISOString(),
        raw: published,
      };
    }

    const children: string[] = [];
    for (const item of media) {
      const container = (await metaPost(
        `${userId}/media`,
        {
          image_url: item.url,
          is_carousel_item: "true",
          access_token: input.accessToken,
        },
        true,
        "PROVIDER_PUBLISH"
      )) as { id?: string };
      children.push(String(container.id ?? ""));
    }
    const container = (await metaPost(
      `${userId}/media`,
      {
        media_type: "CAROUSEL",
        children: children.join(","),
        caption: input.content,
        access_token: input.accessToken,
      },
      true,
      "PROVIDER_PUBLISH"
    )) as { id?: string };
    const published = (await metaPost(
      `${userId}/media_publish`,
      { creation_id: String(container.id ?? ""), access_token: input.accessToken },
      true,
      "PROVIDER_PUBLISH"
    )) as { id?: string };
    return {
      providerPostId: String(published.id ?? container.id),
      url: `https://www.instagram.com/p/${String(published.id ?? container.id)}`,
      publishedAt: new Date().toISOString(),
      raw: published,
    };
  }

  private async publishSingle(
    userId: string,
    media: { url: string; type: string },
    input: PublishInput
  ): Promise<PublishResult> {
    const isVideo = media.type === "VIDEO";
    const container = (await metaPost(
      `${userId}/media`,
      {
        media_type: isVideo ? "VIDEO" : "IMAGE",
        ...(isVideo ? { video_url: media.url } : { image_url: media.url }),
        caption: input.content,
        access_token: input.accessToken,
      },
      true,
      "PROVIDER_PUBLISH"
    )) as { id?: string };
    if (!container.id) {
      throw new PublishingError({
        code: "PROVIDER_ERROR",
        stage: "PROVIDER_PUBLISH",
        message: "Instagram did not return a media container.",
        retryable: true,
      });
    }
    const published = (await metaPost(
      `${userId}/media_publish`,
      { creation_id: String(container.id), access_token: input.accessToken },
      true,
      "PROVIDER_PUBLISH"
    )) as { id?: string };
    return {
      providerPostId: String(published.id ?? container.id),
      url: `https://www.instagram.com/p/${String(published.id ?? container.id)}`,
      publishedAt: new Date().toISOString(),
      raw: published,
    };
  }

  override async getPublishingStatus(providerPostId: string): Promise<PublishingStatusResult> {
    const body = await metaGraph(providerPostId, { fields: "id,permalink,status" }, true, "PROVIDER_PUBLISH");
    const status = String(body.status ?? "");
    if (status === "FINISHED" || body.permalink) {
      return { status: "PUBLISHED", url: String(body.permalink ?? "") || null };
    }
    if (status === "ERROR") {
      return { status: "FAILED", message: "Instagram could not publish the media container." };
    }
    return { status: "PENDING" };
  }
}

export function isMetaConfigured(): boolean {
  return getProviderCredentials("FACEBOOK") !== null || getProviderCredentials("INSTAGRAM") !== null;
}
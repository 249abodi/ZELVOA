import { OAuth2SocialProvider } from "@/lib/integrations/oauth-provider";
import type {
  ExchangedToken,
  ProviderAccountRecord,
  PublishInput,
  PublishResult,
  PublishingStatusResult,
} from "@/lib/integrations/types";
import { PublishingError } from "@/lib/publishing/errors";

interface LinkedInErrorBody {
  message?: string;
  serviceErrorCode?: number;
}

function linkedinError(body: LinkedInErrorBody, retryable: boolean, stage: "PROVIDER_PUBLISH" | "PROVIDER_AUTH") {
  const message = body?.message ?? "LinkedIn returned an error.";
  let code: "PROVIDER_RATE_LIMITED" | "PROVIDER_PERMISSION" | "AUTH_EXPIRED" | "PROVIDER_ERROR" = "PROVIDER_ERROR";
  if (body?.serviceErrorCode === 429) code = "PROVIDER_RATE_LIMITED";
  else if (body?.serviceErrorCode === 400) code = "PROVIDER_PERMISSION";
  else if (body?.serviceErrorCode === 401) code = "AUTH_EXPIRED";
  throw new PublishingError({ code, stage, message, retryable });
}

/**
 * LinkedIn member-share publishing. Connects the member profile and publishes
 * text-only updates to their feed. Media documents via the Upload API are not
 * implemented yet, so posts that include media are rejected with a clear error.
 */
export class LinkedInProvider extends OAuth2SocialProvider {
  constructor() {
    super("LINKEDIN");
  }

  override async getAccounts(exchanged: ExchangedToken): Promise<ProviderAccountRecord[]> {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${exchanged.accessToken}` },
    });
    if (!res.ok) {
      linkedinError(
        { message: `Profile lookup failed (${res.status}).`, serviceErrorCode: res.status },
        false,
        "PROVIDER_AUTH"
      );
    }
    const me = (await res.json()) as { sub?: string; given_name?: string; family_name?: string; name?: string };
    const id = String(me.sub ?? "");
    if (!id) {
      throw new PublishingError({
        code: "PROVIDER_ERROR",
        stage: "PROVIDER_AUTH",
        message: "LinkedIn did not return a profile identifier.",
        retryable: false,
      });
    }
    return [
      {
        platform: "LINKEDIN",
        platformAccountId: `urn:li:person:${id}`,
        name: String(me.name ?? [me.given_name, me.family_name].filter(Boolean).join(" ") ?? "LinkedIn profile"),
        username: null,
        avatarUrl: null,
        scopes: exchanged.scopes ?? [],
        status: "CONNECTED",
        token: {
          accessToken: exchanged.accessToken,
          refreshToken: exchanged.refreshToken,
          expiresInSeconds: exchanged.expiresInSeconds,
          scopes: exchanged.scopes ?? [],
          platformAccountId: `urn:li:person:${id}`,
          name: String(me.name ?? "LinkedIn profile"),
          username: null,
          avatarUrl: null,
        },
        isDevProvider: false,
      },
    ];
  }

  override async publish(input: PublishInput): Promise<PublishResult> {
    if (input.media && input.media.length > 0) {
      throw new PublishingError({
        code: "MEDIA_INVALID",
        stage: "PROVIDER_PUBLISH",
        message: "LinkedIn media publishing is not implemented. Post text only.",
        retryable: false,
      });
    }
    if (!String(input.platformAccountId).startsWith("urn:li:")) {
      throw new PublishingError({
        code: "ACCOUNT_INVALID",
        stage: "PROVIDER_PUBLISH",
        message: "The connected LinkedIn account is not a valid member URN.",
        retryable: false,
      });
    }
    const res = await fetch("https://api.linkedin.com/rest/shares", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: input.platformAccountId,
        commentary: input.content,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED" },
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as LinkedInErrorBody;
      linkedinError(body, res.status >= 500 || res.status === 429, "PROVIDER_PUBLISH");
    }
    const providerPostId = res.headers.get("x-restli-id") ?? "";
    return {
      providerPostId,
      url: null,
      publishedAt: new Date().toISOString(),
      raw: { id: providerPostId },
    };
  }

  override async getPublishingStatus(providerPostId: string): Promise<PublishingStatusResult> {
    if (!providerPostId) return { status: "PENDING" };
    return { status: "PUBLISHED" };
  }
}
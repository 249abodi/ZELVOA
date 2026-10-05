import { OAuth2SocialProvider } from "@/lib/integrations/oauth-provider";
import type {
  ExchangedToken,
  ProviderAccountRecord,
  PublishInput,
  PublishResult,
  PublishingStatusResult,
} from "@/lib/integrations/types";
import { PublishingError } from "@/lib/publishing/errors";

interface XErrorBody {
  errors?: Array<{ message?: string; code?: number }>;
  title?: string;
  detail?: string;
}

function xError(body: XErrorBody, retryable: boolean, stage: "PROVIDER_PUBLISH" | "PROVIDER_AUTH", status?: number) {
  const message = body?.detail ?? body?.errors?.[0]?.message ?? "X returned an error.";
  let code: "PROVIDER_RATE_LIMITED" | "PROVIDER_PERMISSION" | "PROVIDER_DUPLICATE" | "AUTH_EXPIRED" | "PROVIDER_ERROR" = "PROVIDER_ERROR";
  const apiCode = body?.errors?.[0]?.code;
  if (apiCode === 88 || apiCode === 429) code = "PROVIDER_RATE_LIMITED";
  else if (status === 401 || apiCode === 32 || apiCode === 89) code = "AUTH_EXPIRED";
  else if (apiCode === 187 || apiCode === 321) code = "PROVIDER_DUPLICATE";
  else if (status === 403 || [64, 120, 449, 450].includes(apiCode ?? -1)) code = "PROVIDER_PERMISSION";
  throw new PublishingError({ code, stage, message, retryable });
}

/**
 * X (Twitter) OAuth2 publishing. Text posts only via the X API v2; media upload
 * requires the OAuth 1.0a upload flow and is not implemented.
 */
export class XProvider extends OAuth2SocialProvider {
  constructor() {
    super("X");
  }

  override async getAccounts(exchanged: ExchangedToken): Promise<ProviderAccountRecord[]> {
    const res = await fetch("https://api.x.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${exchanged.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as XErrorBody;
      xError(body, false, "PROVIDER_AUTH", res.status);
    }
    const body = (await res.json()) as { data?: { id?: string; username?: string; name?: string } };
    const id = String(body?.data?.id ?? "");
    const username = body?.data?.username ?? null;
    if (!id) {
      throw new PublishingError({
        code: "PROVIDER_ERROR",
        stage: "PROVIDER_AUTH",
        message: "X did not return the connected user.",
        retryable: false,
      });
    }
    return [
      {
        platform: "X",
        platformAccountId: id,
        name: String(body.data?.name ?? username ?? "X account"),
        username,
        avatarUrl: null,
        scopes: exchanged.scopes ?? [],
        status: "CONNECTED",
        token: {
          accessToken: exchanged.accessToken,
          refreshToken: exchanged.refreshToken,
          expiresInSeconds: exchanged.expiresInSeconds,
          scopes: exchanged.scopes ?? [],
          platformAccountId: id,
          name: String(body.data?.name ?? username ?? "X account"),
          username,
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
        message: "X media publishing is not implemented. Post text only.",
        retryable: false,
      });
    }
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: input.content }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as XErrorBody;
      xError(body, res.status >= 500 || res.status === 429, "PROVIDER_PUBLISH", res.status);
    }
    const body = (await res.json()) as { data?: { id?: string } };
    const id = String(body?.data?.id ?? "");
    if (!id) {
      throw new PublishingError({
        code: "PROVIDER_ERROR",
        stage: "PROVIDER_PUBLISH",
        message: "X did not return a tweet id.",
        retryable: false,
      });
    }
    return {
      providerPostId: id,
      url: `https://x.com/${input.platformAccountId}/status/${id}`,
      publishedAt: new Date().toISOString(),
      raw: body,
    };
  }

  override async getPublishingStatus(providerPostId: string): Promise<PublishingStatusResult> {
    void providerPostId;
    return { status: "PENDING" };
  }
}

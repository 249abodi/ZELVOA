import { createHash } from "node:crypto";
import { getPlatformMeta } from "@/lib/integrations/platforms";
import { getProviderCredentials } from "@/lib/integrations/registry";
import {
  accountRecordFromExchange,
  type ExchangedToken,
  type Platform,
  type ProviderAccountRecord,
  type PublishInput,
  type PublishResult,
  type PublishingStatusResult,
  type RefreshResult,
  type SocialProvider,
} from "@/lib/integrations/types";
import { PublishingError } from "@/lib/publishing/errors";

export interface OAuthEndpointConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
  profileEndpoint?: string;
  scopes: string[];
}

export const OAUTH_ENDPOINTS: Record<Platform, OAuthEndpointConfig> = {
  INSTAGRAM: {
    authorizationEndpoint: "https://www.facebook.com/v25.0/dialog/oauth",
    tokenEndpoint: "https://graph.facebook.com/v25.0/oauth/access_token",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
  },
  FACEBOOK: {
    authorizationEndpoint: "https://www.facebook.com/v25.0/dialog/oauth",
    tokenEndpoint: "https://graph.facebook.com/v25.0/oauth/access_token",
    revocationEndpoint: "https://graph.facebook.com/v25.0/{userId}/permissions",
    scopes: ["pages_manage_posts", "pages_show_list"],
  },
  TIKTOK: {
    authorizationEndpoint: "https://www.tiktok.com/v2/auth/authorize/",
    tokenEndpoint: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.publish"],
  },
  LINKEDIN: {
    authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
    tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["w_member_social", "r_liteprofile", "r_emailaddress"],
  },
  X: {
    authorizationEndpoint: "https://x.com/i/oauth2/authorize",
    tokenEndpoint: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  },
  YOUTUBE: {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
  },
};

export class OAuth2SocialProvider implements SocialProvider {
  readonly platform: Platform;
  readonly configured: boolean;
  readonly isDevProvider = false;

  constructor(platform: Platform) {
    this.platform = platform;
    this.configured = getProviderCredentials(platform) !== null;
  }

  get capabilities() {
    return getPlatformMeta(this.platform).capabilities;
  }

  getCredentials() {
    return getProviderCredentials(this.platform);
  }

  buildAuthorizationUrl(opts: {
    state: string;
    redirectUri: string;
    scopes?: string[];
    codeVerifier?: string;
  }): string {
    const creds = this.getCredentials();
    if (!creds) throw new Error("OAuth client credentials are not configured.");
    const cfg = OAUTH_ENDPOINTS[this.platform];
    const url = new URL(cfg.authorizationEndpoint);
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("redirect_uri", opts.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", opts.state);
    url.searchParams.set("scope", (opts.scopes ?? cfg.scopes).join(" "));
    url.searchParams.set("prompt", "consent");
    if (this.platform === "X") {
      if (!opts.codeVerifier) throw new Error("X OAuth requires a PKCE code verifier.");
      url.searchParams.set("code_challenge", createCodeChallenge(opts.codeVerifier));
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<ExchangedToken> {
    const creds = this.getCredentials();
    if (!creds) throw new Error("OAuth client credentials are not configured.");
    const cfg = OAUTH_ENDPOINTS[this.platform];

    if (this.platform === "X" && !codeVerifier) throw new Error("X OAuth PKCE verification failed.");
    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    if (this.platform === "X") body.set("code_verifier", codeVerifier!);
    else {
      body.set("client_id", creds.clientId);
      body.set("client_secret", creds.clientSecret);
    }
    const res = await fetch(cfg.tokenEndpoint, {
      method: "POST",
      headers: this.platform === "X"
        ? { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}` }
        : { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Token exchange failed (${res.status}).`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    if (!accessToken) throw new Error("Provider did not return an access token.");
    const refreshToken =
      typeof data.refresh_token === "string" ? data.refresh_token : undefined;
    const expiresIn =
      typeof data.expires_in === "number" ? data.expires_in : null;

    const profile = await this.fetchProfile(accessToken).catch(() => null);

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: expiresIn,
      scopes: (cfg.scopes ?? []) as string[],
      platformAccountId: profile?.platformAccountId ?? accessToken.slice(0, 24),
      name: profile?.name ?? `Connected ${this.platform} account`,
      username: profile?.username ?? null,
      avatarUrl: (data.avatar_url as string) ?? null,
      raw: data,
    };
  }

  private async fetchProfile(accessToken: string): Promise<ExchangedToken | null> {
    const cfg = OAUTH_ENDPOINTS[this.platform];
    if (!cfg.profileEndpoint) return null;
    const res = await fetch(cfg.profileEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      accessToken,
      platformAccountId: String(data.id ?? ""),
      name: String((data.name as string) ?? ""),
      username: data.username as string | null,
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const creds = this.getCredentials();
    if (!creds) throw new Error("OAuth client credentials are not configured.");
    const cfg = OAUTH_ENDPOINTS[this.platform];
    const body = new URLSearchParams({ refresh_token: refreshToken, grant_type: "refresh_token" });
    if (this.platform !== "X") {
      body.set("client_id", creds.clientId);
      body.set("client_secret", creds.clientSecret);
    }
    const res = await fetch(cfg.tokenEndpoint, {
      method: "POST",
      headers: this.platform === "X"
        ? { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}` }
        : { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Token refresh failed (${res.status}).`);
    const data = (await res.json()) as Record<string, unknown>;
    return {
      accessToken: String(data.access_token ?? ""),
      refreshToken:
        typeof data.refresh_token === "string" ? data.refresh_token : undefined,
      expiresInSeconds:
        typeof data.expires_in === "number" ? data.expires_in : null,
    };
  }

  async revoke(_accessToken: string, refreshToken?: string): Promise<void> {
    const cfg = OAUTH_ENDPOINTS[this.platform];
    if (this.platform === "X") {
      const creds = this.getCredentials();
      if (!creds) return;
      for (const [token, hint] of [[_accessToken, "access_token"], [refreshToken, "refresh_token"]] as const) {
        if (!token) continue;
        await fetch("https://api.x.com/2/oauth2/revoke", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams({ token, token_type_hint: hint }),
        }).catch(() => undefined);
      }
      return;
    }
    if (!cfg.revocationEndpoint) return;
    const creds = this.getCredentials();
    if (!creds) return;
    await fetch(cfg.revocationEndpoint, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${_accessToken}` },
    }).catch(() => undefined);
  }

  /**
   * Default account discovery: a single account derived from the exchanged
   * token. Providers that surface several accounts (Facebook pages, ...) or
   * resolve the account only after the token exchange override this method.
   */
  async getAccounts(exchanged: ExchangedToken): Promise<ProviderAccountRecord[]> {
    return [accountRecordFromExchange(exchanged, this.platform)];
  }

  /** @internal Not implemented for platforms that only connect. */
  async publish(_input: PublishInput): Promise<PublishResult> {
    throw new PublishingError({
      code: "NOT_IMPLEMENTED",
      stage: "PROVIDER_PUBLISH",
      message: `Publishing is not implemented for ${this.platform}.`,
      retryable: false,
    });
  }

  /** @internal Not implemented for platforms that only connect. */
  async getPublishingStatus(_providerPostId: string): Promise<PublishingStatusResult> {
    throw new PublishingError({
      code: "NOT_IMPLEMENTED",
      stage: "PROVIDER_PUBLISH",
      message: "Publishing status is not supported for this platform.",
      retryable: false,
    });
  }
}

export function providerFor(platform: Platform): SocialProvider {
  return new OAuth2SocialProvider(platform);
}

function createCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function emptyProviderRecord(platform: Platform): Omit<ProviderAccountRecord, "token" | "status"> {
  const meta = getPlatformMeta(platform);
  return {
    platform,
    platformAccountId: "",
    name: meta.label,
    username: null,
    avatarUrl: null,
    scopes: [],
    isDevProvider: false,
  };
}

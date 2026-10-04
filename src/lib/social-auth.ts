import { createHash, randomBytes } from "node:crypto";
import type { AuthProvider } from "@prisma/client";

export type LoginProvider = AuthProvider;

export const LOGIN_PROVIDERS: readonly LoginProvider[] = [
  "GOOGLE",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "X",
] as const;

export const LOGIN_PROVIDER_LABELS: Record<LoginProvider, string> = {
  GOOGLE: "Google",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
};

export function isLoginProvider(value: unknown): value is LoginProvider {
  return (
    typeof value === "string" &&
    (LOGIN_PROVIDERS as readonly string[]).includes(value)
  );
}

interface LoginProviderConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  usesPKCE: boolean;
  tokenAuthHeader?: boolean;
}

const PROVIDER_ENV: Record<LoginProvider, { id: string; secret: string }> = {
  GOOGLE: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
  FACEBOOK: { id: "FACEBOOK_AUTH_CLIENT_ID", secret: "FACEBOOK_AUTH_CLIENT_SECRET" },
  INSTAGRAM: { id: "INSTAGRAM_AUTH_CLIENT_ID", secret: "INSTAGRAM_AUTH_CLIENT_SECRET" },
  TIKTOK: { id: "TIKTOK_CLIENT_KEY", secret: "TIKTOK_CLIENT_SECRET" },
  X: { id: "X_CLIENT_ID", secret: "X_CLIENT_SECRET" },
};

const PROVIDER_CONFIG: Record<LoginProvider, LoginProviderConfig> = {
  GOOGLE: {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
    usesPKCE: false,
  },
  FACEBOOK: {
    authorizationEndpoint: "https://www.facebook.com/v25.0/dialog/oauth",
    tokenEndpoint: "https://graph.facebook.com/v25.0/oauth/access_token",
    scopes: ["email", "public_profile"],
    usesPKCE: false,
  },
  INSTAGRAM: {
    authorizationEndpoint: "https://www.facebook.com/v25.0/dialog/oauth",
    tokenEndpoint: "https://graph.facebook.com/v25.0/oauth/access_token",
    scopes: ["instagram_basic", "public_profile"],
    usesPKCE: false,
  },
  TIKTOK: {
    authorizationEndpoint: "https://www.tiktok.com/v2/auth/authorize/",
    tokenEndpoint: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic"],
    usesPKCE: false,
  },
  X: {
    authorizationEndpoint: "https://x.com/i/oauth2/authorize",
    tokenEndpoint: "https://api.x.com/2/oauth2/token",
    scopes: ["users.read"],
    usesPKCE: true,
    tokenAuthHeader: true,
  },
};

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export function getProviderCredentials(
  provider: LoginProvider
): ProviderCredentials | null {
  const env = PROVIDER_ENV[provider];
  const clientId = process.env[env.id]?.trim();
  const clientSecret = process.env[env.secret]?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isProviderConfigured(provider: LoginProvider): boolean {
  return getProviderCredentials(provider) !== null;
}

export function providerLabel(provider: LoginProvider): string {
  return LOGIN_PROVIDER_LABELS[provider];
}

export interface SocialProfile {
  provider: LoginProvider;
  providerAccountId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export function syntheticEmail(provider: LoginProvider, providerAccountId: string): string {
  return `${provider.toLowerCase()}.${providerAccountId}@social.local`;
}

export function buildAuthorizationUrl(opts: {
  provider: LoginProvider;
  state: string;
  redirectUri: string;
  codeChallenge?: string;
}): string {
  const creds = getProviderCredentials(opts.provider);
  if (!creds) throw new Error("Provider is not configured.");
  const cfg = PROVIDER_CONFIG[opts.provider];
  const url = new URL(cfg.authorizationEndpoint);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("scope", cfg.scopes.join(" "));
  if (opts.provider !== "X") url.searchParams.set("prompt", "select_account");
  if (cfg.usesPKCE && !opts.codeChallenge) {
    throw new Error("X OAuth requires a PKCE code challenge.");
  }
  if (cfg.usesPKCE && opts.codeChallenge) {
    url.searchParams.set("code_challenge", opts.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function exchangeCode(opts: {
  provider: LoginProvider;
  code: string;
  redirectUri: string;
  codeVerifier?: string | null;
}): Promise<string> {
  const creds = getProviderCredentials(opts.provider);
  if (!creds) throw new Error("Provider is not configured.");
  const cfg = PROVIDER_CONFIG[opts.provider];

  if (cfg.usesPKCE && !opts.codeVerifier) {
    throw new Error("X OAuth requires a PKCE code verifier.");
  }

  const params = new URLSearchParams({
    code: opts.code,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
  });
  if (!cfg.tokenAuthHeader) {
    params.set("client_id", creds.clientId);
    params.set("client_secret", creds.clientSecret);
  }
  if (cfg.usesPKCE && opts.codeVerifier) {
    params.set("code_verifier", opts.codeVerifier);
  }

  const res = await fetch(cfg.tokenEndpoint, {
    method: "POST",
    headers: cfg.tokenAuthHeader
      ? {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${creds.clientId}:${creds.clientSecret}`
          ).toString("base64")}`,
        }
      : { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}).`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const accessToken = typeof data.access_token === "string" ? data.access_token : "";
  if (!accessToken) throw new Error("Provider did not return an access token.");
  return accessToken;
}

export async function fetchProfile(
  provider: LoginProvider,
  accessToken: string
): Promise<SocialProfile> {
  switch (provider) {
    case "GOOGLE":
      return fetchGoogleProfile(accessToken);
    case "FACEBOOK":
      return fetchFacebookProfile(accessToken);
    case "INSTAGRAM":
      return fetchInstagramProfile(accessToken);
    case "TIKTOK":
      return fetchTiktokProfile(accessToken);
    case "X":
      return fetchXProfile(accessToken);
  }
}

async function fetchGoogleProfile(accessToken: string): Promise<SocialProfile> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google profile fetch failed (${res.status}).`);
  const data = (await res.json()) as Record<string, unknown>;
  const id = String(data.sub ?? "");
  if (!id) throw new Error("Google did not return a stable user id.");
  const email = typeof data.email === "string" && data.email ? data.email : null;
  return {
    provider: "GOOGLE",
    providerAccountId: id,
    email: email?.toLowerCase() ?? null,
    name: String(data.name ?? email ?? "Google user"),
    avatarUrl: typeof data.picture === "string" ? data.picture : null,
    emailVerified: data.email_verified === true,
  };
}

async function fetchFacebookProfile(accessToken: string): Promise<SocialProfile> {
  const url = new URL("https://graph.facebook.com/v25.0/me");
  url.searchParams.set("fields", "id,name,email,picture");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Facebook profile fetch failed (${res.status}).`);
  const data = (await res.json()) as Record<string, unknown>;
  const id = String(data.id ?? "");
  if (!id) throw new Error("Facebook did not return a user id.");
  const email = typeof data.email === "string" && data.email ? data.email : null;
  const picture = data.picture as { data?: { url?: unknown } } | undefined;
  return {
    provider: "FACEBOOK",
    providerAccountId: id,
    email: email?.toLowerCase() ?? null,
    name: String(data.name ?? email ?? "Facebook user"),
    avatarUrl:
      typeof picture?.data?.url === "string" ? picture.data.url : null,
    emailVerified: Boolean(email),
  };
}

async function fetchInstagramProfile(accessToken: string): Promise<SocialProfile> {
  const url = new URL("https://graph.instagram.com/me");
  url.searchParams.set("fields", "id,username,account_type,media_count");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Instagram profile fetch failed (${res.status}).`);
  const data = (await res.json()) as Record<string, unknown>;
  const id = String(data.id ?? "");
  if (!id) throw new Error("Instagram did not return a user id.");
  const username = typeof data.username === "string" ? data.username : null;
  return {
    provider: "INSTAGRAM",
    providerAccountId: id,
    email: null,
    name: String(username ?? "Instagram user"),
    avatarUrl: null,
    emailVerified: false,
  };
}

async function fetchTiktokProfile(accessToken: string): Promise<SocialProfile> {
  const url = new URL("https://open.tiktokapis.com/v2/user/info/");
  url.searchParams.set(
    "fields",
    "open_id,union_id,display_name,avatar_url"
  );
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`TikTok profile fetch failed (${res.status}).`);
  const data = (await res.json()) as {
    data?: { user?: Record<string, unknown> };
    error?: { code?: unknown };
  };
  if (data.error && data.error.code !== 0 && data.error.code !== undefined) {
    throw new Error("TikTok profile fetch was denied.");
  }
  const user = data.data?.user ?? {};
  const id =
    String(user.open_id ?? user.union_id ?? "");
  if (!id) throw new Error("TikTok did not return a stable user id.");
  return {
    provider: "TIKTOK",
    providerAccountId: id,
    email: null,
    name: String(user.display_name ?? "TikTok user"),
    avatarUrl: typeof user.avatar_url === "string" ? user.avatar_url : null,
    emailVerified: false,
  };
}

async function fetchXProfile(accessToken: string): Promise<SocialProfile> {
  const url = new URL("https://api.x.com/2/users/me");
  url.searchParams.set("user.fields", "id,name,username,profile_image_url");
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ZELVOA",
    },
  });
  if (!res.ok) throw new Error(`X profile fetch failed (${res.status}).`);
  const body = (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: unknown[];
  };
  if (body.errors?.length) throw new Error("X profile fetch was denied.");
  const data = body.data ?? {};
  const id = String(data.id ?? "");
  if (!id) throw new Error("X did not return a stable user id.");
  return {
    provider: "X",
    providerAccountId: id,
    email: null,
    name: String(data.name ?? data.username ?? "X user"),
    avatarUrl: typeof data.profile_image_url === "string" ? data.profile_image_url : null,
    emailVerified: false,
  };
}

export function sanitizeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.length > 512) return null;
  return value;
}

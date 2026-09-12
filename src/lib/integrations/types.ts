import type { PlatformType, PostType, SocialConnectionStatus } from "@prisma/client";

export type Platform = PlatformType;

export interface ProviderCapabilities {
  publish: boolean;
  schedule: boolean;
  messaging: boolean;
  analytics: boolean;
}

export interface ExchangedToken {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number | null;
  scopes?: string[];
  platformAccountId: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  raw?: Record<string, unknown>;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number | null;
}

export interface PublishMediaInput {
  url: string;
  mimeType: string;
  type: "IMAGE" | "VIDEO";
  altText?: string | null;
}

export interface PublishInput {
  accessToken: string;
  platformAccountId: string;
  content: string;
  firstComment?: string | null;
  postType: PostType;
  media?: PublishMediaInput[];
}

export interface PublishResult {
  providerPostId: string;
  url?: string | null;
  publishedAt: string;
  raw?: Record<string, unknown>;
}

export interface PublishingStatusResult {
  status: "PUBLISHED" | "FAILED" | "PENDING";
  url?: string | null;
  message?: string | null;
}

export interface SocialProvider {
  platform: Platform;
  configured: boolean;
  isDevProvider: boolean;
  capabilities: ProviderCapabilities;
  buildAuthorizationUrl(opts: {
    state: string;
    redirectUri: string;
    scopes?: string[];
  }): string;
  exchangeCode(code: string, redirectUri: string): Promise<ExchangedToken>;
  refresh(refreshToken: string): Promise<RefreshResult>;
  revoke(accessToken: string): Promise<void>;
  getAccounts?(exchanged: ExchangedToken): Promise<ProviderAccountRecord[]>;
  publish?(input: PublishInput): Promise<PublishResult>;
  getPublishingStatus?(providerPostId: string): Promise<PublishingStatusResult>;
}

export interface ProviderAccountRecord {
  platform: Platform;
  platformAccountId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  scopes: string[];
  status: SocialConnectionStatus;
  token: Omit<ExchangedToken, "raw"> | null;
  isDevProvider: boolean;
  errorMessage?: string | null;
}

export function accountRecordFromExchange(
  exchanged: ExchangedToken,
  platform: Platform
): ProviderAccountRecord {
  return {
    platform,
    platformAccountId: exchanged.platformAccountId,
    name: exchanged.name,
    username: exchanged.username ?? null,
    avatarUrl: exchanged.avatarUrl ?? null,
    scopes: exchanged.scopes ?? [],
    status: "CONNECTED",
    token: {
      accessToken: exchanged.accessToken,
      refreshToken: exchanged.refreshToken,
      expiresInSeconds: exchanged.expiresInSeconds,
      scopes: exchanged.scopes ?? [],
      platformAccountId: exchanged.platformAccountId,
      name: exchanged.name,
      username: exchanged.username ?? null,
      avatarUrl: exchanged.avatarUrl ?? null,
    },
    isDevProvider: false,
  };
}

export const ALL_PLATFORMS: Platform[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "LINKEDIN",
  "X",
  "YOUTUBE",
];
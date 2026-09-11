import type { PlatformType, SocialConnectionStatus } from "@prisma/client";

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

export const ALL_PLATFORMS: Platform[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "LINKEDIN",
  "X",
  "YOUTUBE",
];
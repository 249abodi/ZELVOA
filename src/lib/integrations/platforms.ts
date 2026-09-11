import type { IconName } from "@/components/icons";
import type { Platform, ProviderCapabilities } from "@/lib/integrations/types";

export interface PlatformMeta {
  platform: Platform;
  label: string;
  icon: IconName;
  capabilities: ProviderCapabilities;
  authUrlBuilder: "oauth2" | "oauth2-pkce-global";
  envClientId: string;
  envClientSecret: string;
  iconClass: string;
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  INSTAGRAM: {
    platform: "INSTAGRAM",
    label: "Instagram",
    icon: "instagram",
    capabilities: { publish: true, schedule: true, messaging: true, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "INSTAGRAM_CLIENT_ID",
    envClientSecret: "INSTAGRAM_CLIENT_SECRET",
    iconClass: "bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300",
  },
  FACEBOOK: {
    platform: "FACEBOOK",
    label: "Facebook",
    icon: "facebook",
    capabilities: { publish: true, schedule: true, messaging: true, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "FACEBOOK_CLIENT_ID",
    envClientSecret: "FACEBOOK_CLIENT_SECRET",
    iconClass: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300",
  },
  TIKTOK: {
    platform: "TIKTOK",
    label: "TikTok",
    icon: "tiktok",
    capabilities: { publish: true, schedule: false, messaging: false, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "TIKTOK_CLIENT_ID",
    envClientSecret: "TIKTOK_CLIENT_SECRET",
    iconClass: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
  },
  LINKEDIN: {
    platform: "LINKEDIN",
    label: "LinkedIn",
    icon: "linkedin",
    capabilities: { publish: true, schedule: true, messaging: false, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "LINKEDIN_CLIENT_ID",
    envClientSecret: "LINKEDIN_CLIENT_SECRET",
    iconClass: "bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300",
  },
  X: {
    platform: "X",
    label: "X",
    icon: "xtwitter",
    capabilities: { publish: true, schedule: true, messaging: false, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "X_CLIENT_ID",
    envClientSecret: "X_CLIENT_SECRET",
    iconClass: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
  },
  YOUTUBE: {
    platform: "YOUTUBE",
    label: "YouTube",
    icon: "video",
    capabilities: { publish: true, schedule: false, messaging: false, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "YOUTUBE_CLIENT_ID",
    envClientSecret: "YOUTUBE_CLIENT_SECRET",
    iconClass: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
};

export function getPlatformMeta(platform: Platform): PlatformMeta {
  return PLATFORM_META[platform];
}

export function getCapabilities(platform: Platform): ProviderCapabilities {
  return PLATFORM_META[platform].capabilities;
}
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getRegistryEntry,
  areDevProvidersAllowed,
  isProduction,
  getPlatformBaseUrl,
  resolvePublicBaseUrl,
} from "@/lib/integrations/registry";

const envKeys = [
  "INSTAGRAM_CLIENT_ID",
  "INSTAGRAM_CLIENT_SECRET",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "TIKTOK_CLIENT_ID",
  "TIKTOK_CLIENT_SECRET",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "ALLOW_DEV_PROVIDERS",
  "NEXT_PUBLIC_APP_URL",
  "NODE_ENV",
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("provider registry gating", () => {
  it("is never in production when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isProduction()).toBe(true);
    expect(areDevProvidersAllowed()).toBe(false);
  });

  it("allows dev providers only when ALLOW_DEV_PROVIDERS=true outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_PROVIDERS", "true");
    expect(areDevProvidersAllowed()).toBe(true);
  });

  it("keeps dev providers disabled without the explicit flag", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_PROVIDERS", "false");
    expect(areDevProvidersAllowed()).toBe(false);
  });

  it("reports unconfigured providers with an actionable reason when dev is off", () => {
    envKeys.forEach((k) => vi.stubEnv(k, ""));
    vi.stubEnv("ALLOW_DEV_PROVIDERS", "false");
    const entry = getRegistryEntry("INSTAGRAM");
    expect(entry.configured).toBe(false);
    expect(entry.devMode).toBe(false);
    expect(entry.reason).toContain("INSTAGRAM_CLIENT_ID");
  });

  it("reports dev mode when dev providers are enabled", () => {
    vi.stubEnv("ALLOW_DEV_PROVIDERS", "true");
    const entry = getRegistryEntry("INSTAGRAM");
    expect(entry.devMode).toBe(true);
    expect(entry.reason).toContain("ALLOW_DEV_PROVIDERS");
  });

  it("treats full credentials as the real provider over dev mode", () => {
    vi.stubEnv("INSTAGRAM_CLIENT_ID", "cid");
    vi.stubEnv("INSTAGRAM_CLIENT_SECRET", "csec");
    vi.stubEnv("ALLOW_DEV_PROVIDERS", "true");
    const entry = getRegistryEntry("INSTAGRAM");
    expect(entry.configured).toBe(true);
    expect(entry.devMode).toBe(false);
  });

  it("requires both client id and secret to be configured", () => {
    vi.stubEnv("INSTAGRAM_CLIENT_ID", "cid");
    vi.stubEnv("INSTAGRAM_CLIENT_SECRET", "");
    vi.stubEnv("ALLOW_DEV_PROVIDERS", "false");
    expect(getRegistryEntry("INSTAGRAM").configured).toBe(false);
  });
});

describe("public base URL resolution", () => {
  it("uses the request origin first even when the env var is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(getPlatformBaseUrl("https://zelvoa.vercel.app")).toBe(
      "https://zelvoa.vercel.app"
    );
  });

  it("prefers the request origin over a configured env base", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://zelvoa.vercel.app");
    expect(getPlatformBaseUrl("https://preview.zelvoa.vercel.app")).toBe(
      "https://preview.zelvoa.vercel.app"
    );
  });

  it("falls back to the configured env base when no request origin is provided", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://zelvoa.vercel.app");
    expect(getPlatformBaseUrl()).toBe("https://zelvoa.vercel.app");
  });

  it("ignores a blank or whitespace-only env value", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "   ");
    expect(resolvePublicBaseUrl(undefined)).toBe("http://localhost:3000");
  });

  it("ignores a non-URL env value instead of throwing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not a url");
    expect(resolvePublicBaseUrl("https://zelvoa.vercel.app")).toBe(
      "https://zelvoa.vercel.app"
    );
  });

  it("normalises the request origin through the URL parser", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(resolvePublicBaseUrl("https://zelvoa.vercel.app/x")).toBe(
      "https://zelvoa.vercel.app"
    );
  });

  it("only accepts http(s) schemes", () => {
    expect(resolvePublicBaseUrl("javascript:alert(1)")).toBe(
      "http://localhost:3000"
    );
  });
});
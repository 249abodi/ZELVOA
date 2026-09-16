import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getStorage, resetStorageForTest } from "@/lib/storage/factory";
import { LocalStorageProvider } from "@/lib/storage/local";
import { S3StorageProvider } from "@/lib/storage/s3";

const ENV_KEYS = [
  "STORAGE_BUCKET",
  "STORAGE_REGION",
  "STORAGE_ENDPOINT",
  "STORAGE_FORCE_PATH_STYLE",
  "STORAGE_LOCAL_DIR",
] as const;

beforeEach(() => {
  resetStorageForTest();
});

afterEach(() => {
  resetStorageForTest();
  for (const key of ENV_KEYS) delete process.env[key];
  vi.restoreAllMocks();
});

describe("getStorage", () => {
  it("uses the local provider when no bucket is configured (dev fallback)", () => {
    expect(getStorage()).toBeInstanceOf(LocalStorageProvider);
  });

  it("uses an S3-compatible provider when STORAGE_BUCKET is set", () => {
    process.env.STORAGE_BUCKET = "zelvoa-prod-media";
    process.env.STORAGE_REGION = "eu-central-1";
    const storage = getStorage();
    expect(storage).toBeInstanceOf(S3StorageProvider);
    expect(storage.name).toBe("s3");
  });

  it("defaults the region for endpoint-style buckets", () => {
    process.env.STORAGE_BUCKET = "zelvoa-r2";
    process.env.STORAGE_ENDPOINT = "https://account.r2.cloudflarestorage.com";
    process.env.STORAGE_FORCE_PATH_STYLE = "true";
    const storage = getStorage();
    expect(storage).toBeInstanceOf(S3StorageProvider);
    expect(storage.name).toBe("s3");
  });

  it("stays on local storage when the bucket value is blank", () => {
    process.env.STORAGE_BUCKET = "";
    expect(getStorage()).toBeInstanceOf(LocalStorageProvider);
  });
});
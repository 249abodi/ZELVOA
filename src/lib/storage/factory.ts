import path from "node:path";
import { LocalStorageProvider } from "@/lib/storage/local";
import { S3StorageProvider } from "@/lib/storage/s3";
import type { StorageProvider } from "@/lib/storage/types";

const DEFAULT_DIR = path.join(process.cwd(), ".zelvoa-storage");

let provider: StorageProvider | null = null;

/**
 * Resolves the active storage provider.
 *
 * When `STORAGE_BUCKET` is set, an S3-compatible provider is used — required
 * in production, where the serverless function filesystem is read-only and
 * ephemeral. Without a bucket, the local provider is used for development.
 * Cloud backends are never simulated: real bytes only ever land in a real
 * destination.
 */
export function getStorage(): StorageProvider {
  if (!provider) {
    const bucket = process.env.STORAGE_BUCKET?.trim();
    if (bucket) {
      provider = new S3StorageProvider({
        bucket,
        region: process.env.STORAGE_REGION?.trim() || "us-east-1",
        ...(process.env.STORAGE_ENDPOINT?.trim()
          ? { endpoint: process.env.STORAGE_ENDPOINT.trim() }
          : {}),
        ...(process.env.STORAGE_FORCE_PATH_STYLE === "true"
          ? { forcePathStyle: true }
          : {}),
      });
    } else {
      provider = new LocalStorageProvider(
        process.env.STORAGE_LOCAL_DIR ? path.resolve(process.env.STORAGE_LOCAL_DIR) : DEFAULT_DIR
      );
    }
  }
  return provider;
}

export function resetStorageForTest(): void {
  provider = null;
}
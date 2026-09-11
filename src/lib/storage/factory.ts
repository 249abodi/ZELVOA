import path from "node:path";
import { LocalStorageProvider } from "@/lib/storage/local";
import type { StorageProvider } from "@/lib/storage/types";

const DEFAULT_DIR = path.join(process.cwd(), ".zelvoa-storage");

let provider: StorageProvider | null = null;

/**
 * Resolves the active storage provider.
 *
 * Currently the local provider is the only shipped implementation. Cloud
 * backends are intentionally NOT simulated: if `STORAGE_BUCKET`/`STORAGE_REGION`
 * are set but no provider is implemented yet, we keep using local storage so
 * real data is never written to a fake destination.
 */
export function getStorage(): StorageProvider {
  if (!provider) {
    provider = new LocalStorageProvider(
      process.env.STORAGE_LOCAL_DIR ? path.resolve(process.env.STORAGE_LOCAL_DIR) : DEFAULT_DIR
    );
  }
  return provider;
}

export function resetStorageForTest(): void {
  provider = null;
}
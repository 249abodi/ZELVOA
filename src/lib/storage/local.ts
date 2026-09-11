import { randomBytes } from "crypto";
import path from "node:path";
import { StorageError, type StorageProvider, type StoredObject, type ObjectStream } from "@/lib/storage/types";

interface ManifestEntry {
  sizeBytes: number;
  sha256: string;
}

interface Manifest {
  version: 1;
  entries: Record<string, ManifestEntry>;
}

/**
 * Local filesystem-backed storage provider.
 *
 * Objects are stored under `<STORAGE_LOCAL_DIR>/<key>` and referenced in a
 * manifest (`manifest.json`) that stores each object's size and SHA-256 so we
 * can detect corruption and backfill records. Keys are sanitized at the
 * boundary: absolute paths, traversal (`..`) and colons are rejected.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";

  constructor(private rootDir: string) {}

  get root(): string {
    return this.rootDir;
  }

  private resolve(key: string): string {
    if (typeof key !== "string" || key.length === 0) {
      throw new StorageError("Storage key must be a non-empty string.", "INVALID_KEY");
    }
    if (key.includes("..") || key.startsWith("/") || path.isAbsolute(key) || /[:"*?<>|]/.test(key)) {
      throw new StorageError("Storage key is invalid.", "INVALID_KEY");
    }
    const resolved = path.join(this.rootDir, key);
    const relative = path.relative(this.rootDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new StorageError("Storage key escapes the storage root.", "INVALID_KEY");
    }
    return resolved;
  }

  private async readManifest(): Promise<Manifest> {
    try {
      const raw = await import("node:fs/promises").then((fsp) =>
        fsp.readFile(path.join(this.rootDir, "manifest.json"), "utf8")
      );
      const parsed = JSON.parse(raw) as Manifest;
      if (parsed.version !== 1) return { version: 1, entries: {} };
      return { version: 1, entries: parsed.entries ?? {} };
    } catch {
      return { version: 1, entries: {} };
    }
  }

  private async writeManifest(manifest: Manifest): Promise<void> {
    const fsp = await import("node:fs/promises");
    const tmp = path.join(this.rootDir, ".manifest.tmp");
    await fsp.writeFile(tmp, JSON.stringify(manifest, null, 2), "utf8");
    await fsp.rename(tmp, path.join(this.rootDir, "manifest.json"));
  }

  async put(key: string, data: Buffer, contentType: string | null): Promise<StoredObject> {
    const fsp = await import("node:fs/promises");
    const { createHash } = await import("node:crypto");
    const target = this.resolve(key);
    void contentType;

    await fsp.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${randomBytes(6).toString("hex")}.tmp`;
    await fsp.writeFile(tmp, data);
    await fsp.rename(tmp, target);

    const checksum = createHash("sha256").update(data).digest("hex");
    const manifest = await this.readManifest();
    manifest.entries[key] = { sizeBytes: data.length, sha256: checksum };
    await this.writeManifest(manifest);

    return { key, sizeBytes: data.length, contentType, checksum };
  }

  async get(key: string): Promise<Buffer> {
    const fsp = await import("node:fs/promises");
    try {
      return await fsp.readFile(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Object not found.", "NOT_FOUND");
      }
      throw new StorageError("Could not read object.", "IO_ERROR");
    }
  }

  async getStream(key: string): Promise<ObjectStream> {
    const { createReadStream } = await import("node:fs");
    const target = this.resolve(key);
    const stream = createReadStream(target);
    return new Promise((resolve, reject) => {
      stream.once("open", () => resolve(stream));
      stream.once("error", (err: NodeJS.ErrnoException) => {
        reject(
          err.code === "ENOENT"
            ? new StorageError("Object not found.", "NOT_FOUND")
            : new StorageError("Could not read object.", "IO_ERROR")
        );
      });
    });
  }

  async exists(key: string): Promise<boolean> {
    const fsp = await import("node:fs/promises");
    try {
      await fsp.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const fsp = await import("node:fs/promises");
    const target = this.resolve(key);
    try {
      await fsp.unlink(target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw new StorageError("Could not delete object.", "IO_ERROR");
    }
    const manifest = await this.readManifest();
    if (manifest.entries[key]) {
      delete manifest.entries[key];
      await this.writeManifest(manifest);
    }
    return true;
  }

  async move(fromKey: string, toKey: string): Promise<boolean> {
    const fsp = await import("node:fs/promises");
    const from = this.resolve(fromKey);
    const to = this.resolve(toKey);
    await fsp.mkdir(path.dirname(to), { recursive: true });
    try {
      await fsp.rename(from, to);
    } catch {
      // fall back to copy + delete for cross-volume cases
      const data = await this.get(fromKey);
      await this.put(toKey, data, null);
      await this.delete(fromKey);
    }
    const manifest = await this.readManifest();
    if (manifest.entries[fromKey]) {
      manifest.entries[toKey] = manifest.entries[fromKey];
      delete manifest.entries[fromKey];
      await this.writeManifest(manifest);
    }
    return true;
  }
}

export const defineLocalProvider = (dir: string) => new LocalStorageProvider(dir);
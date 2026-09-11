import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalStorageProvider } from "@/lib/storage/local";
import { StorageError } from "@/lib/storage/types";

describe("LocalStorageProvider", () => {
  let dir: string;
  let store: LocalStorageProvider;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "zelvoa-storage-"));
    store = new LocalStorageProvider(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("stores and returns an object with true size and checksum", async () => {
    const stored = await store.put("ws/a.txt", Buffer.from("hello world"), "text/plain");
    expect(stored.sizeBytes).toBe(11);
    expect(stored.checksum).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );
    const got = await store.get("ws/a.txt");
    expect(got.toString()).toBe("hello world");
  });

  it("creates parent directories automatically", async () => {
    await store.put("a/b/c/d.bin", Buffer.from([1, 2, 3]), null);
    expect(existsSync(path.join(dir, "a", "b", "c", "d.bin"))).toBe(true);
  });

  it("rejects traversal keys", async () => {
    await expect(store.put("../../escape", Buffer.from("x"), null)).rejects.toThrow(
      StorageError
    );
    await expect(store.put("a/../../escape.txt", Buffer.from("x"), null)).rejects.toThrow(
      StorageError
    );
  });

  it("rejects absolute and colon keys", async () => {
    await expect(store.put("C:\\evil.txt", Buffer.from("x"), null)).rejects.toThrow();
    await expect(store.put("/root/x", Buffer.from("x"), null)).rejects.toThrow();
  });

  it("exists/delete lifecycle", async () => {
    await store.put("k.txt", Buffer.from("data"), null);
    expect(await store.exists("k.txt")).toBe(true);
    expect(await store.delete("k.txt")).toBe(true);
    expect(await store.exists("k.txt")).toBe(false);
    expect(await store.delete("k.txt")).toBe(false);
  });

  it("move relocates bytes and manifest entry", async () => {
    await store.put("from/a.txt", Buffer.from("payload"), null);
    await store.move("from/a.txt", "to/a.txt");
    expect(await store.exists("from/a.txt")).toBe(false);
    expect((await store.get("to/a.txt")).toString()).toBe("payload");
  });

  it("records a manifest entry on write", async () => {
    await store.put("m.txt", Buffer.from("abc"), "text/plain");
    const manifestPath = path.join(dir, "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.entries["m.txt"].sha256).toHaveLength(64);
    expect(manifest.entries["m.txt"].sizeBytes).toBe(3);
  });

  it("throws NOT_FOUND for missing objects", async () => {
    try {
      await store.get("nope.bin");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(StorageError);
      if (err instanceof StorageError) expect(err.code).toBe("NOT_FOUND");
    }
  });

  it("appends multiple entries into one manifest", async () => {
    await store.put("a.txt", Buffer.from("1"), null);
    await store.put("b/c.txt", Buffer.from("22"), null);
    const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
    expect(Object.keys(manifest.entries).sort()).toEqual(["a.txt", "b/c.txt"]);
  });
});
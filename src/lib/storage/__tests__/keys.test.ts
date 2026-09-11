import { describe, it, expect } from "vitest";
import {
  sanitizeFileName,
  sanitizeDirectoryName,
  buildMediaKey,
  buildThumbKey,
} from "@/lib/storage/keys";

describe("sanitizeFileName", () => {
  it("strips path components", () => {
    expect(sanitizeFileName("../../etc/passwd.jpg")).toBe("passwd.jpg");
  });

  it("collapses unsafe characters", () => {
    expect(sanitizeFileName('a<b>:c"d|e?f*').includes(":")).toBe(false);
  });

  it("falls back to a safe default for empty names", () => {
    expect(sanitizeFileName("")).toBe("file");
  });
});

describe("sanitizeDirectoryName", () => {
  it("block dot-paths", () => {
    expect(sanitizeDirectoryName("..")).toBe("folder");
    expect(sanitizeDirectoryName(".")).toBe("folder");
  });

  it("rejects traversal", () => {
    expect(sanitizeDirectoryName("../../x")).not.toContain("/");
    expect(sanitizeDirectoryName("../../x")).not.toContain("..");
  });

  it("truncates long names", () => {
    const long = "a".repeat(200);
    expect(sanitizeDirectoryName(long).length).toBeLessThanOrEqual(80);
  });
});

describe("buildMediaKey", () => {
  it("creates a namespaced key with date and slug", () => {
    const key = buildMediaKey({
      workspaceId: "ws_1",
      originalName: "My Brand Post!.png",
      id: "ckzpymnd20000",
      date: new Date("2026-07-15T00:00:00Z"),
    });
    expect(key.startsWith("ws_1/media/2026/07/")).toBe(true);
    expect(key.endsWith(".png")).toBe(true);
    expect(key).toContain("my-brand-post");
    expect(key.includes("!")).toBe(false);
  });

  it("never contains a space", () => {
    const key = buildMediaKey({
      workspaceId: "ws_1",
      originalName: "a file with spaces.png",
      id: "ckzpymnd20000",
    });
    expect(key.includes(" ")).toBe(false);
  });

  it("flags traversal attempts through names", () => {
    const key = buildMediaKey({
      workspaceId: "ws_1",
      originalName: "../../../../etc/evil.sh",
      id: "abc",
    });
    expect(key.includes("..")).toBe(false);
    expect(key.split("/").some((segment) => segment === "." || segment === "..")).toBe(false);
  });
});

describe("buildThumbKey", () => {
  it("produces a distinct key for the same object", () => {
    const key = "ws_1/media/2026/07/post.jpg";
    const thumb = buildThumbKey(key);
    expect(thumb).toMatch(/^ws_1\/media\/2026\/07\/thumb-[a-z0-9]+\.jpg$/);
    expect(thumb).not.toBe(key);
  });

  it("returns null for already-thumbnail keys", () => {
    expect(buildThumbKey("x/thumb-abc.jpg")).toBeNull();
  });
});
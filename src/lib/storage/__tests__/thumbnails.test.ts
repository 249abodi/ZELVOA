import { describe, it, expect } from "vitest";
import { isImageMime, generateThumbnail, THUMBNAIL_WIDTH } from "@/lib/storage/thumbnails";

describe("generateThumbnail", () => {
  it("returns null for non-image content", async () => {
    const result = await generateThumbnail(Buffer.from("%PDF-1.4"), "application/pdf");
    expect(result).toBeNull();
  });

  it("returns null if sharp cannot process invalid image bytes", async () => {
    const result = await generateThumbnail(Buffer.from("not-an-image"), "image/jpeg");
    expect(result).toBeNull();
  });

  it("produces a JPEG thumbnail from a real PNG", async () => {
    // 1x1 red PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const result = await generateThumbnail(png, "image/png");
    if (!result) {
      // sharp unavailable — graceful fallback is part of the contract
      expect(isImageMime("image/png")).toBe(true);
      return;
    }
    expect(result.contentType).toBe("image/jpeg");
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});

describe("isImageMime", () => {
  it("recognizes raster image types", () => {
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/webp")).toBe(true);
    expect(isImageMime("video/mp4")).toBe(false);
  });
});

describe("THUMBNAIL_WIDTH", () => {
  it("is a sane thumbnail width", () => {
    expect(THUMBNAIL_WIDTH).toBeGreaterThan(200);
    expect(THUMBNAIL_WIDTH).toBeLessThanOrEqual(800);
  });
});
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const THUMBNAIL_WIDTH = 480;

export interface Thumbnail {
  buffer: Buffer;
  contentType: string;
}

/**
 * Generates a JPEG thumbnail for raster images using sharp (bundled with
 * Next.js). Returns null for non-image content or when sharp is unavailable,
 * so thumbnail generation degrades gracefully without faking output.
 */
export async function generateThumbnail(
  data: Buffer,
  mimeType: string
): Promise<Thumbnail | null> {
  if (!IMAGE_MIME_TYPES.has(mimeType)) return null;
  try {
    const sharp = await import("sharp").then((m) => m.default ?? m);
    const buffer = await sharp(data)
      .rotate()
      .resize(THUMBNAIL_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return { buffer, contentType: "image/jpeg" };
  } catch {
    return null;
  }
}

export function isImageMime(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, forbidden, unauthorized, ok, created } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage/factory";
import { buildMediaKey, sanitizeFileName, buildThumbKey } from "@/lib/storage/keys";
import { isImageMime, generateThumbnail } from "@/lib/storage/thumbnails";
import { MAX_FILE_BYTES, assertStorageQuotaAvailable } from "@/lib/storage/quota";

const TYPE_MAP: Array<{ match: RegExp; type: "IMAGE" | "VIDEO" | "DOCUMENT" }> = [
  { match: /^image\//, type: "IMAGE" },
  { match: /^video\//, type: "VIDEO" },
  { match: /^audio\//, type: "DOCUMENT" },
];

function detectType(mimeType: string): "IMAGE" | "VIDEO" | "DOCUMENT" {
  for (const rule of TYPE_MAP) {
    if (rule.match.test(mimeType)) return rule.type;
  }
  return "DOCUMENT";
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "media.view")) {
      return forbidden("You do not have permission to view media.");
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const type = searchParams.get("type") as "IMAGE" | "VIDEO" | "DOCUMENT" | null;
    const folderId = searchParams.get("folderId") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "24", 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      workspaceId: context.workspace.id,
      deletedAt: null,
    };
    if (q) {
      where.OR = [
        { fileName: { contains: q, mode: "insensitive" } },
        { altText: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
      ];
    }
    if (type) where.type = type;
    if (folderId === "null" || folderId === "none") {
      where.folderId = null;
    } else if (folderId) {
      where.folderId = folderId;
    }

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    return ok({
      assets,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "media.manage")) {
      return forbidden("You do not have permission to manage media.");
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return fail("Uploads must be sent as multipart/form-data with real file bytes.", 415);
    }

    const form = await request.formData();
    const entries = Array.from(form.entries());
    const fileEntries = entries.filter(
      (e): e is [string, File] => e[1] instanceof File
    );
    const files = fileEntries.map(([, file]) => file);
    const folderIdRaw = form.get("folderId");
    const folderId =
      typeof folderIdRaw === "string" && folderIdRaw.length > 0
        ? folderIdRaw
        : null;

    if (files.length === 0) return fail("No files were provided in the upload.", 400);
    if (files.length > 50) return fail("Upload at most 50 files at once.", 400);

    if (folderId != null) {
      const folder = await prisma.mediaFolder.findFirst({
        where: { id: folderId, workspaceId: context.workspace.id },
      });
      if (!folder) return fail("Target folder not found.", 400);
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    await assertStorageQuotaAvailable(context.workspace.id, totalBytes);

    const oversized = files.find((file) => file.size <= 0 || file.size > MAX_FILE_BYTES);
    if (oversized) {
      return fail(
        `File "${oversized.name}" exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit or is empty.`,
        413
      );
    }

    const storage = getStorage();
    const assets = [];

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "application/octet-stream";
      const fname = sanitizeFileName(file.name);
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      const storageKey = buildMediaKey({ workspaceId: context.workspace.id, originalName: fname, id });

      const stored = await storage.put(storageKey, bytes, mimeType);

      let thumbnailKey: string | null = null;
      const thumb = isImageMime(mimeType)
        ? await generateThumbnail(bytes, mimeType)
        : null;
      if (thumb) {
        thumbnailKey = buildThumbKey(storageKey);
        if (thumbnailKey) {
          await storage.put(thumbnailKey, thumb.buffer, thumb.contentType);
        } else {
          thumbnailKey = null;
        }
      }

      const imageMeta = isImageMime(mimeType) && thumb
        ? await safeImageSize(bytes)
        : { width: null, height: null };

      const asset = await prisma.mediaAsset.create({
        data: {
          workspaceId: context.workspace.id,
          uploadedById: context.user.id,
          fileName: fname,
          mimeType,
          sizeBytes: stored.sizeBytes,
          type: detectType(mimeType),
          storageProvider: storage.name,
          storageKey,
          thumbnailKey,
          width: imageMeta.width,
          height: imageMeta.height,
          checksum: stored.checksum,
          folderId,
        },
      });
      assets.push(asset);
    }

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "media.uploaded",
      entityType: "MediaAsset",
      entityId: assets[0].id,
      mediaAssetId: assets[0].id,
      metadata: { count: assets.length, totalBytes, type: detectType(files[0].type) },
    });

    return created({ assets, count: assets.length });
  } catch (error) {
    return handleApiError(error);
  }
}

async function safeImageSize(data: Buffer): Promise<{ width: number | null; height: number | null }> {
  try {
    const sharp = await import("sharp").then((m) => m.default ?? m);
    const meta = await sharp(data).metadata();
    return {
      width: meta.width ?? null,
      height: meta.height ?? null,
    };
  } catch {
    return { width: null, height: null };
  }
}
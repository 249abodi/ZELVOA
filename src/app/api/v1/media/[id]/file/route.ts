import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, fail, notFound } from "@/lib/api";
import { getStorage } from "@/lib/storage/factory";
import { verifyMediaSignature } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const signature = searchParams.get("sig");

    const context = await getCurrentContext();
    if (!context) {
      if (!signature || !verifyMediaSignature(id, signature)) return unauthorized();
    } else if (!context.workspace) {
      return fail("No workspace selected.", 400);
    } else if (!can(context.role, "media.view")) {
      return fail("You do not have permission to view media.", 403);
    }
    const viewerWorkspaceId = context?.workspace?.id ?? null;

    const asset = await prisma.mediaAsset.findFirst({
      where: viewerWorkspaceId
        ? { id, workspaceId: viewerWorkspaceId, deletedAt: null }
        : { id, deletedAt: null },
    });
    if (!asset) return notFound("Media asset not found.");

    const storage = getStorage();
    const stream = await storage.getStream(asset.storageKey);

    const response = new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.sizeBytes),
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.fileName)}"`,
        "Cache-Control": signature ? "private, max-age=3600" : "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
    void request;
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
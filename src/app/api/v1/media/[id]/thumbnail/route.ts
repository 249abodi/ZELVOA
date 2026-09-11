import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, fail, notFound } from "@/lib/api";
import { getStorage } from "@/lib/storage/factory";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "media.view")) {
      return fail("You do not have permission to view media.", 403);
    }

    const { id } = await params;
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, workspaceId: context.workspace.id, deletedAt: null },
    });
    if (!asset) return notFound("Media asset not found.");
    if (!asset.thumbnailKey) return notFound("No thumbnail is available for this asset.");

    const storage = getStorage();
    const stream = await storage.getStream(asset.thumbnailKey);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
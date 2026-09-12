import { prisma } from "@/lib/db";

export async function GET() {
  const time = new Date().toISOString();
  const headers = { "Cache-Control": "no-store" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", database: "connected", time },
      { status: 200, headers }
    );
  } catch {
    return Response.json(
      { status: "degraded", database: "unavailable", time },
      { status: 503, headers }
    );
  }
}
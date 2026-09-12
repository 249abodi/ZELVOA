import { NextResponse } from "next/server";
import { schedulerRunSchema } from "@/lib/validators";
import { publishingService } from "@/lib/publishing/service";
import { fail, ok } from "@/lib/api";
import { safeEqual } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const { searchParams } = new URL(request.url);
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const token =
    searchParams.get("token") || request.headers.get("x-cron-secret") || bearer || "";
  if (!token) return false;
  return safeEqual(token, secret);
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return fail("Scheduler is not configured or the request is not authorized.", 503);
  }
  try {
    const body = await request.json().catch(() => null);
    const parsed = schedulerRunSchema.safeParse(body ?? {});
    const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;

    const result = await publishingService.pumpDue(limit);
    return ok(result);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: { message: "Scheduler run failed." } },
        { status: 500 }
      );
    }
    return fail("Scheduler run failed.", 500);
  }
}
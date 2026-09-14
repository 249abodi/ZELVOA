import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(message: string, status = 400, details?: unknown, headers?: HeadersInit) {
  return NextResponse.json(
    { error: { message, ...(details && typeof details === "object" ? details : {}) } },
    { status, headers }
  );
}

export function unauthorized(message = "Unauthorized") {
  return fail(message, 401);
}

export function forbidden(message = "Forbidden") {
  return fail(message, 403);
}

export function notFound(message = "Not found") {
  return fail(message, 404);
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("Validation failed", 422, error.flatten());
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return fail("A record with these details already exists.", 409);
    }
    if (error.code === "P2025") {
      return notFound("Record not found.");
    }
    return fail("Database error.", 500);
  }
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    console.error("[api] Database unavailable (Prisma client error).");
    return fail("Service temporarily unavailable.", 503);
  }
  console.error("[api]", error);
  return fail("Internal server error.", 500);
}

export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
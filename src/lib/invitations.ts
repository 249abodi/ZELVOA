import { randomBytes } from "crypto";
import { createSignature } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";

export const INVITATION_TTL_DAYS = 7;

export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createSignature(`invite:${token}`);
}

export function buildInviteUrl(origin: string, token: string): string {
  return `${origin}/invite?token=${encodeURIComponent(token)}`;
}

export function getInviteBaseUrl(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = forwarded === "http" || forwarded === "https" ? forwarded : "https";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function findInvitationForToken(token: string) {
  if (!token) return null;
  const tokenHash = hashInviteToken(token);
  return prisma.invitation.findUnique({ where: { tokenHash } });
}

export function isInvitationValid(invitation: {
  status: unknown;
  expiresAt: Date;
}): boolean {
  return invitation.status === "PENDING" && invitation.expiresAt.getTime() > Date.now();
}

export const INVITE_ROLES: UserRole[] = [
  "ADMIN",
  "CONTENT_MANAGER",
  "DESIGNER",
  "SOCIAL_MEDIA_MANAGER",
  "VIEWER",
];
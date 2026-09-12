import { prisma } from "@/lib/db";
import { createHmac } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FORMAT_PATTERN = new RegExp(
  `^ZELVOA-[${ALPHABET}]{4}-[${ALPHABET}]{4}-[${ALPHABET}]{4}$`
);

export function generateLicenseKey(): string {
  const segments = Array.from({ length: 3 }, () => segment());
  return `ZELVOA-${segments.join("-")}`;
}

function segment(): string {
  return Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
}

export function isValidLicenseKeyFormat(key: string): boolean {
  return FORMAT_PATTERN.test(normalizeLicenseKey(key));
}

export function normalizeLicenseKey(key: string): string {
  return key.trim().toUpperCase();
}

export function signLicensePayload(payload: string): string {
  const secret = process.env.LICENSE_SECRET ?? process.env.AUTH_SECRET ?? "zelvoa-license-dev";
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
}

export async function activateLicense(
  organizationId: string,
  input: { key: string; planSlug: string }
): Promise<{ ok: boolean; error?: string; license?: { key: string; planSlug: string; expiresAt: Date | null } }> {
  const key = normalizeLicenseKey(input.key);

  if (!isValidLicenseKeyFormat(key)) {
    return { ok: false, error: "Invalid license key format. Expected: ZELVOA-XXXX-XXXX-XXXX." };
  }

  const plan = await prisma.plan.findUnique({
    where: { slug: input.planSlug },
    select: { id: true, slug: true, isFree: true },
  });
  if (!plan || plan.isFree) {
    return { ok: false, error: "Cannot activate a license for the free plan." };
  }

  const existing = await prisma.licenseKey.findUnique({ where: { key } });
  if (existing && existing.organizationId !== organizationId) {
    return { ok: false, error: "This license key is already in use by another organization." };
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const license = await prisma.licenseKey.upsert({
    where: { organizationId },
    create: {
      organizationId,
      key,
      planSlug: plan.slug,
      seats: 1,
      status: "ACTIVE",
      activatedAt: now,
      expiresAt,
    },
    update: {
      key,
      planSlug: plan.slug,
      status: "ACTIVE",
      activatedAt: now,
      expiresAt,
    },
    select: { key: true, planSlug: true, expiresAt: true },
  });

  return { ok: true, license: { key: license.key, planSlug: license.planSlug, expiresAt: license.expiresAt } };
}
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { activateLicense } from "@/lib/billing/license";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const activateSchema = z.object({
  key: z.string().min(1),
  planSlug: z.string().min(1),
});

const MASKED_KEY = "ZELVOA-••••-••••-••••";

export async function GET() {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.organization) return fail("No organization selected.", 400);
    if (!can(context.role, "billing.manage")) {
      return fail("You do not have permission to view license keys.", 403);
    }

    const license = await prisma.licenseKey.findUnique({
      where: { organizationId: context.organization.id },
      select: { key: true, planSlug: true, seats: true, status: true, expiresAt: true, activatedAt: true },
    });
    if (!license) return ok({ license: null });
    return ok({ license: { ...license, key: MASKED_KEY } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.organization) return fail("No organization selected.", 400);
    if (!can(context.role, "billing.manage")) {
      return fail("You do not have permission to activate license keys.", 403);
    }

    const parsed = activateSchema.parse(await request.json().catch(() => null));
    const result = await activateLicense(context.organization.id, {
      key: parsed.key,
      planSlug: parsed.planSlug,
    });

    if (!result.ok) return fail(result.error ?? "Could not activate license.", 400);
    if (!result.license) return fail("Could not activate license.", 400);

    await writeAudit({
      organizationId: context.organization.id,
      workspaceId: context.workspace?.id,
      actorId: context.user.id,
      action: "license.activated",
      entityType: "LicenseKey",
      entityId: context.organization.id,
      metadata: { planSlug: result.license.planSlug },
    });

    return ok({ license: { ...result.license, key: MASKED_KEY } });
  } catch (error) {
    return handleApiError(error);
  }
}
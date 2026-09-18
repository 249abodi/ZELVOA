import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleApiError, unauthorized, ok } from "@/lib/api";
import {
  updateNotificationPreferencesSchema,
} from "@/lib/validators";
import { parseJson } from "@/lib/api";

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();

    const raw = await parseJson(request);
    const body = updateNotificationPreferencesSchema.parse(raw);

    const settings = await prisma.userSettings.upsert({
      where: { userId: context.user.id },
      create: {
        userId: context.user.id,
        emailNotifications: body.emailNotifications,
        inAppNotifications: body.inAppNotifications,
        marketingEmails: body.marketingEmails,
      },
      update: {
        emailNotifications: body.emailNotifications,
        inAppNotifications: body.inAppNotifications,
        marketingEmails: body.marketingEmails,
      },
      select: {
        emailNotifications: true,
        inAppNotifications: true,
        marketingEmails: true,
      },
    });

    return ok({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
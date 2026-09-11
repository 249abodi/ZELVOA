import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { z } from "zod";
import { handleApiError, unauthorized, ok } from "@/lib/api";

const profileSchema = z.object({
  name: z.string().min(2).max(100),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();

    const raw = await request.json();
    const body = profileSchema.parse(raw);

    const user = await prisma.user.update({
      where: { id: context.user.id },
      data: {
        name: body.name,
        timezone: body.timezone,
        locale: body.locale,
      },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        locale: true,
      },
    });

    return ok({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
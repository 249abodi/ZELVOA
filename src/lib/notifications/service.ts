import { prisma } from "@/lib/db";
import type { NotificationType, Prisma } from "@prisma/client";

export interface CreateNotificationInput {
  workspaceId?: string | null;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Prisma.InputJsonValue;
}

export async function createNotification(input: CreateNotificationInput): Promise<boolean> {
  const settings = await prisma.userSettings
    .findUnique({ where: { userId: input.userId } })
    .catch(() => null);

  if (settings && settings.inAppNotifications === false) return false;

  try {
    await prisma.notification.create({
      data: {
        workspaceId: input.workspaceId ?? null,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function createNotifications(
  inputs: CreateNotificationInput[]
): Promise<number> {
  if (inputs.length === 0) return 0;
  let created = 0;
  for (const input of inputs) {
    if (await createNotification(input)) created += 1;
  }
  return created;
}
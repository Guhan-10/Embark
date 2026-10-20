import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

export const notificationListSchema = z.object({
  unreadOnly: z.union([z.boolean(), z.stringbool()]).default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** A user only ever sees their own notifications. */
export async function listNotifications(user: CurrentUser, rawFilters: z.input<typeof notificationListSchema> = {}) {
  const f = notificationListSchema.parse(rawFilters);
  const where = { userId: user.id, ...(f.unreadOnly ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return {
    items,
    total,
    unread,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

export async function getUnreadCount(user: CurrentUser) {
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}

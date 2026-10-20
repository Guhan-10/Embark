import type { getUnreadCount, listNotifications } from "./queries";

export type NotificationList = Awaited<ReturnType<typeof listNotifications>>;
export type NotificationItem = NotificationList["items"][number];
export type UnreadCount = Awaited<ReturnType<typeof getUnreadCount>>;

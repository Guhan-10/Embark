"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireUser } from "@/lib/auth/rbac";
import { runAction, type ActionResult } from "@/lib/utils/action";
import { getUnreadCount } from "./queries";
import { markAllNotificationsRead, markNotificationRead } from "./service";

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await markNotificationRead(user.id, id);
    revalidatePath("/notifications");
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ marked: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    const marked = await markAllNotificationsRead(user.id);
    revalidatePath("/notifications");
    return { marked };
  });
}

/** For the bell icon to poll. Zero when signed out. */
export async function getUnreadCountAction(): Promise<number> {
  const user = await getCurrentUser();
  return user ? getUnreadCount(user) : 0;
}

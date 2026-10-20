"use client";

import { useTransition } from "react";
import Link from "next/link";
import { BellOff, CheckCheck } from "lucide-react";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { formatTimeAgo } from "@/lib/utils/format";
import { markAllNotificationsReadAction } from "../actions";
import type { NotificationItem } from "../types";
import { NotificationIcon } from "./notification-icon";

/** The latest notifications, newest raised like a card on top of the others. */
export function NotificationsCard({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const [pending, startTransition] = useTransition();

  const markAll = () =>
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) toast.error(result.error);
    });

  return (
    <DashboardCard
      title="Notifications"
      action={
        unread > 0 ? (
          <button
            type="button"
            onClick={markAll}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <CheckCheck className="size-4" aria-hidden="true" /> Mark all read
          </button>
        ) : (
          { href: "/notifications", label: "View all" }
        )
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
          <BellOff className="mb-2 size-6" aria-hidden="true" />
          You&apos;re all caught up.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((n, i) => (
            <li key={n.id}>
              <Link
                href={n.link ?? "/notifications"}
                className={cn(
                  "flex gap-3 rounded-2xl p-3.5 transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                  i === 0
                    ? "bg-card shadow-raised ring-1 ring-border"
                    : "bg-muted/60 hover:bg-muted",
                )}
              >
                <NotificationIcon type={n.type} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{n.title}</span>
                    {!n.readAt ? <span className="size-2 shrink-0 rounded-full bg-success" aria-label="Unread" /> : null}
                  </span>
                  {n.body ? <span className="block truncate text-xs text-muted-foreground">{n.body}</span> : null}
                  <span className="mt-1 block text-xs text-muted-foreground">{formatTimeAgo(n.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

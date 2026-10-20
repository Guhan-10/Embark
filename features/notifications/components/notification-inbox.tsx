"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatTimeAgo } from "@/lib/utils/format";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import type { NotificationItem } from "../types";
import { NotificationIcon } from "./notification-icon";

/** All | Unread switch. A query param rather than a route, so it reads like the app's other tabs. */
export function InboxTabs({ unreadOnly, unread }: { unreadOnly: boolean; unread: number }) {
  const tabs = [
    { href: "/notifications", label: "All", active: !unreadOnly },
    { href: "/notifications?unread=1", label: unread ? `Unread (${unread})` : "Unread", active: unreadOnly },
  ];
  return (
    <nav aria-label="Filter notifications" className="inline-flex h-11 items-center gap-1 rounded-full bg-card p-1 shadow-xs ring-1 ring-border">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "flex h-full items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
            t.active ? "bg-primary text-primary-foreground" : "text-foreground/60 hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-11 rounded-full bg-card px-5"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllNotificationsReadAction();
          if (!result.ok) toast.error(result.error);
          else if (result.data.marked) toast.success(`Marked ${result.data.marked} as read`);
        })
      }
    >
      <CheckCheck /> Mark all read
    </Button>
  );
}

/** Opening an unread notification marks it read first, then follows its link. */
export function NotificationInbox({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const markRead = (id: string, then?: string) =>
    startTransition(async () => {
      const result = await markNotificationReadAction(id);
      if (!result.ok) toast.error(result.error);
      if (then) router.push(then);
      else router.refresh();
    });

  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-3xl bg-card shadow-xs ring-1 ring-border" aria-busy={pending}>
      {items.map((n) => {
        const unread = !n.readAt;
        const content = (
          <>
            <NotificationIcon type={n.type} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>{n.title}</span>
                {unread ? <span className="size-2 shrink-0 rounded-full bg-success" aria-label="Unread" /> : null}
              </span>
              {n.body ? <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span> : null}
              <time dateTime={n.createdAt.toISOString()} title={formatDateTime(n.createdAt)} className="mt-1 block text-xs text-muted-foreground">
                {formatTimeAgo(n.createdAt)}
              </time>
            </span>
          </>
        );
        return (
          <li key={n.id} className={cn("flex items-start gap-2 pr-3", unread && "bg-accent/40")}>
            {n.link ? (
              <Link
                href={n.link}
                onClick={(e) => {
                  if (!unread || e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  markRead(n.id, n.link!);
                }}
                className="flex min-w-0 flex-1 gap-3 p-4 transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-inset"
              >
                {content}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 gap-3 p-4">{content}</div>
            )}
            {unread ? (
              <Button
                variant="ghost"
                size="icon"
                className="mt-3 shrink-0 rounded-full"
                aria-label={`Mark "${n.title}" as read`}
                title="Mark as read"
                disabled={pending}
                onClick={() => markRead(n.id)}
              >
                <Check />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

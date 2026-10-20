import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { InboxTabs, MarkAllReadButton, NotificationInbox } from "@/features/notifications/components/notification-inbox";
import { listNotifications } from "@/features/notifications/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Notifications" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageAccess();
  const params = await searchParams;
  const unreadOnly = one(params.unread) === "1";
  const page = Number(one(params.page)) || 1;
  const list = await listNotifications(user, { unreadOnly, page: Math.max(1, page) });

  return (
    <>
      <PageHeader
        title="Notifications"
        description={list.unread ? `${plural(list.unread, "unread notification")}.` : "You're all caught up."}
        actions={<MarkAllReadButton disabled={list.unread === 0} />}
      />
      <div className="mb-5">
        <InboxTabs unreadOnly={unreadOnly} unread={list.unread} />
      </div>
      {list.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={unreadOnly ? "Nothing unread" : "No notifications yet"}
          description={unreadOnly ? "You've read everything." : "Task assignments, document reviews, and reminders show up here."}
        />
      ) : (
        <>
          <NotificationInbox items={list.items} />
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} basePath="/notifications" searchParams={params} />
        </>
      )}
    </>
  );
}

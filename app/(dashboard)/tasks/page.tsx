import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { TaskFilters } from "@/features/tasks/components/task-filters";
import { TaskTable } from "@/features/tasks/components/task-table";
import { TaskTabs } from "@/features/tasks/components/task-tabs";
import { listTasks } from "@/features/tasks/queries";
import type { TaskListFilters } from "@/features/tasks/types";
import { isHrViewer, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Tasks" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageAccess(PERMISSIONS.TASK_READ);
  // Everyone except HR works from their own list.
  if (!isHrViewer(user)) redirect("/tasks/assigned-to-me");
  const params = await searchParams;

  const list = await listTasks(user, {
    q: one(params.q),
    status: one(params.status),
    priority: one(params.priority),
    overdue: one(params.overdue),
    includeClosed: one(params.includeClosed),
    page: one(params.page),
  } as TaskListFilters).catch(() => null);
  const filtered = Object.keys(params).some((k) => k !== "page");

  return (
    <>
      <PageHeader
        title="Tasks"
        description={list ? (filtered ? plural(list.total, "match", "matches") : `${plural(list.total, "open task")} in your space`) : undefined}
      />
      <TaskTabs />
      <TaskFilters />
      {!list || list.items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={filtered ? "No tasks match those filters" : "No open tasks"}
          description={filtered ? "Try different filters." : "Tasks appear here once onboarding starts."}
        />
      ) : (
        <>
          <TaskTable items={list.items} />
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} basePath="/tasks" searchParams={params} />
        </>
      )}
    </>
  );
}

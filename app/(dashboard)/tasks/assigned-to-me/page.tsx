import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MyTaskGroups } from "@/features/tasks/components/my-task-groups";
import { TaskTabs } from "@/features/tasks/components/task-tabs";
import { listTasks } from "@/features/tasks/queries";
import { isHrViewer, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "My tasks" };

export default async function MyTasksPage() {
  const user = await requirePageAccess(PERMISSIONS.TASK_READ);
  const [open, done] = await Promise.all([
    listTasks(user, { assignedToMe: true, pageSize: 100 }),
    listTasks(user, { assignedToMe: true, status: "DONE", pageSize: 5, sort: "completedAt", order: "desc" }),
  ]);
  const overdue = open.items.filter((t) => t.isOverdue).length;

  return (
    <>
      <PageHeader
        title="My tasks"
        description={open.total ? `${plural(open.total, "open task")}${overdue ? `, ${overdue} overdue` : ""}` : undefined}
      />
      {isHrViewer(user) ? <TaskTabs /> : null}
      {open.total === 0 && done.total === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing assigned to you" description="When someone assigns you an onboarding task, it shows up here." />
      ) : open.total === 0 ? (
        <>
          <EmptyState icon={ClipboardCheck} title="All done" description="You've finished everything assigned to you." className="mb-5" />
          <MyTaskGroups open={[]} recentlyDone={done.items} />
        </>
      ) : (
        <MyTaskGroups open={open.items} recentlyDone={done.items} />
      )}
    </>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { WorkflowBuilder } from "@/features/onboarding/components/workflow-builder";
import { canViewTemplates, getTemplate, getTemplateFormOptions } from "@/features/onboarding/queries";
import { can, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ASSIGNEE_TYPE, TASK_PRIORITY } from "@/lib/constants/task-status";

export const metadata: Metadata = { title: "Template" };

function dayText(offset: number) {
  if (offset === 0) return "Joining day";
  return offset < 0 ? `Day ${offset}` : `Day +${offset}`;
}

export default async function TemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const user = await requirePageAccess();
  if (!canViewTemplates(user)) redirect("/onboarding");
  const { templateId } = await params;
  const template = await getTemplate(user, templateId);
  if (!template) notFound();

  if (!can(user, PERMISSIONS.TEMPLATE_MANAGE)) {
    return (
      <>
        <PageHeader title={template.name} description={template.description ?? undefined} back={{ href: "/onboarding/templates", label: "Templates" }} />
        <div className="flex flex-col gap-5">
          {template.steps.map((step, i) => (
            <DashboardCard key={step.id} title={`${i + 1}. ${step.title}`}>
              <ul className="flex flex-col divide-y text-sm">
                {step.tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                    <span className="flex-1 font-medium">
                      {t.documentType ? <FileText className="mr-1.5 inline size-3.5 text-muted-foreground" aria-label="Needs a document" /> : null}
                      {t.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{ASSIGNEE_TYPE[t.assigneeType].label}</span>
                    <span className="text-xs text-muted-foreground">{TASK_PRIORITY[t.priority].label}</span>
                    <span className="w-24 text-right text-xs font-semibold">{dayText(t.dueOffsetDays)}</span>
                  </li>
                ))}
              </ul>
            </DashboardCard>
          ))}
        </div>
      </>
    );
  }

  const { departments, documentTypes } = await getTemplateFormOptions(user);
  return (
    <>
      <PageHeader title={`Edit ${template.name}`} back={{ href: "/onboarding/templates", label: "Templates" }} />
      <WorkflowBuilder
        templateId={template.id}
        departments={departments}
        documentTypes={documentTypes}
        initial={{
          name: template.name,
          description: template.description ?? "",
          departmentId: template.departmentId ?? "",
          steps: template.steps.map((s) => ({
            key: s.id,
            title: s.title,
            tasks: s.tasks.map((t) => ({
              key: t.id,
              title: t.title,
              description: t.description ?? "",
              assigneeType: t.assigneeType,
              dueOffsetDays: String(t.dueOffsetDays),
              priority: t.priority,
              documentTypeId: t.documentTypeId ?? "",
            })),
          })),
        }}
      />
    </>
  );
}

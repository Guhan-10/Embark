import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutTemplate, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { OnboardingTabs } from "@/features/onboarding/components/onboarding-tabs";
import { TemplateActiveSwitch } from "@/features/onboarding/components/template-active-switch";
import { canViewTemplates, listTemplates } from "@/features/onboarding/queries";
import { can, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { cn } from "@/lib/utils/cn";
import { formatDay, plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const user = await requirePageAccess();
  if (!canViewTemplates(user)) redirect("/onboarding");
  const canEdit = can(user, PERMISSIONS.TEMPLATE_MANAGE);
  const templates = await listTemplates(user, { includeInactive: canEdit });

  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable checklists. Starting onboarding copies a template's tasks with real due dates."
        actions={
          canEdit ? (
            <Button asChild className="h-11 rounded-full px-5">
              <Link href="/onboarding/templates/new">
                <Plus /> New template
              </Link>
            </Button>
          ) : null
        }
      />
      <OnboardingTabs />
      {templates.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No templates yet" description="Create one for each kind of new hire, e.g. engineers or sales." />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex flex-col rounded-[1.75rem] bg-card p-5 shadow-card",
                !t.isActive && "opacity-70",
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-mint text-success-ink" aria-hidden="true">
                  <LayoutTemplate className="size-5" />
                </span>
                {canEdit ? <TemplateActiveSwitch id={t.id} name={t.name} isActive={t.isActive} /> : null}
              </div>
              <Link href={`/onboarding/templates/${t.id}`} className="text-lg font-bold tracking-tight hover:text-primary">
                {t.name}
              </Link>
              {t.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p> : null}
              <p className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-accent px-2.5 py-1 font-semibold text-accent-foreground">{plural(t.stepCount, "step")}</span>
                <span className="rounded-full bg-accent px-2.5 py-1 font-semibold text-accent-foreground">{plural(t.taskCount, "task")}</span>
                {t.department ? <span className="rounded-full bg-sky px-2.5 py-1 font-semibold text-info-ink">{t.department.name}</span> : null}
              </p>
              <p className="mt-auto pt-4 text-xs text-muted-foreground">
                Used {plural(t.timesUsed, "time")} · updated {formatDay(t.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

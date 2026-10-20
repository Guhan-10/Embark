import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Rocket, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { getEmployeeFormOptions } from "@/features/employees/queries";
import { OnboardingFilters } from "@/features/onboarding/components/onboarding-filters";
import { OnboardingTabs } from "@/features/onboarding/components/onboarding-tabs";
import { ProcessTable } from "@/features/onboarding/components/process-table";
import { listProcesses } from "@/features/onboarding/queries";
import type { ProcessListFilters } from "@/features/onboarding/types";
import { can, hasRole, isHrViewer, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ROLES } from "@/lib/constants/roles";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Onboarding" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageAccess(PERMISSIONS.ONBOARDING_READ);
  const params = await searchParams;
  const hr = isHrViewer(user);

  // New hires have one onboarding: take them straight to it.
  if (!hr && !hasRole(user, ROLES.REPORTING_MANAGER)) {
    const mine = await listProcesses(user, { pageSize: 1 });
    if (mine.items[0]) redirect(`/onboarding/${mine.items[0].id}`);
    return (
      <>
        <PageHeader title="My onboarding" />
        <EmptyState icon={Route} title="Your onboarding hasn't started yet" description="Your HR will start it soon, and you'll get an email when they do." />
      </>
    );
  }

  const [list, options] = await Promise.all([
    listProcesses(user, {
      q: one(params.q),
      status: one(params.status),
      departmentId: one(params.departmentId),
      page: one(params.page),
    } as ProcessListFilters).catch(() => null),
    hr ? getEmployeeFormOptions(user) : null,
  ]);
  const canStart = can(user, PERMISSIONS.ONBOARDING_MANAGE);
  const filtered = Object.keys(params).some((k) => k !== "page");

  return (
    <>
      <PageHeader
        title={hr ? "Onboarding" : "Your team's onboarding"}
        description={list ? (filtered ? plural(list.total, "match", "matches") : plural(list.total, "onboarding")) : undefined}
        actions={
          canStart ? (
            <Button asChild className="h-11 rounded-full px-5">
              <Link href="/onboarding/new">
                <Rocket /> Start onboarding
              </Link>
            </Button>
          ) : null
        }
      />
      {canStart || can(user, PERMISSIONS.TEMPLATE_MANAGE) ? <OnboardingTabs /> : null}
      {options ? <OnboardingFilters departments={options.departments} /> : null}

      {!list || list.items.length === 0 ? (
        <EmptyState
          icon={Route}
          title={filtered ? "Nothing matches those filters" : "No onboarding yet"}
          description={filtered ? "Try a different search or clear the filters." : "Start onboarding for a new hire and their tasks are created from a template."}
          action={
            !filtered && canStart ? (
              <Button asChild size="lg" className="rounded-full">
                <Link href="/onboarding/new">
                  <Rocket /> Start onboarding
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <ProcessTable items={list.items} />
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} basePath="/onboarding" searchParams={params} />
        </>
      )}
    </>
  );
}

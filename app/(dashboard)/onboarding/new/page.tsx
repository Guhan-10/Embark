import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { StartOnboardingForm } from "@/features/onboarding/components/start-onboarding-form";
import { listEmployeesReadyForOnboarding, listTemplatesForStart } from "@/features/onboarding/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";

export const metadata: Metadata = { title: "Start onboarding" };

export default async function StartOnboardingPage({ searchParams }: { searchParams: Promise<{ employeeId?: string }> }) {
  const user = await requirePageAccess(PERMISSIONS.ONBOARDING_MANAGE);
  const { employeeId } = await searchParams;
  const [employees, templates] = await Promise.all([listEmployeesReadyForOnboarding(user), listTemplatesForStart(user)]);

  return (
    <>
      <PageHeader
        title="Start onboarding"
        description="Tasks are created from the template and assigned to the new hire, their HR, and their reporting manager."
        back={{ href: "/onboarding", label: "Onboarding" }}
      />
      <StartOnboardingForm
        defaultEmployeeId={employeeId}
        templates={templates}
        employees={employees.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          code: e.employeeCode,
          joiningDate: e.joiningDate.toISOString(),
          departmentId: e.departmentId,
        }))}
      />
    </>
  );
}

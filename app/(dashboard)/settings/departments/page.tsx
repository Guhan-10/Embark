import type { Metadata } from "next";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { DepartmentCard } from "@/features/settings/components/department-card";
import { DepartmentDialog } from "@/features/settings/components/department-dialog";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { listDepartments, listHrCandidates } from "@/features/settings/queries";
import { can, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const user = await requirePageAccess(PERMISSIONS.DEPARTMENT_MANAGE);
  const [departments, hrCandidates] = await Promise.all([
    listDepartments(user),
    // Choosing a department's HR changes whose space people are in, so it needs user:manage.
    can(user, PERMISSIONS.USER_MANAGE) ? listHrCandidates(user) : null,
  ]);
  const addButton = (
    <DepartmentDialog
      trigger={
        <Button className="h-11 rounded-full px-5">
          <Plus /> Add department
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Departments"
        description="Each department's HR owns everyone in it: they see those people and handle their onboarding, and nobody else's."
        actions={addButton}
      />
      <SettingsTabs user={user} />
      {departments.length === 0 ? (
        <EmptyState icon={Building2} title="No departments yet" description="Add your first department, then its designations and HR." action={addButton} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {departments.map((d) => (
            <DepartmentCard key={d.id} department={d} hrCandidates={hrCandidates} />
          ))}
        </div>
      )}
    </>
  );
}

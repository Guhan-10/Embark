import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { WorkflowBuilder } from "@/features/onboarding/components/workflow-builder";
import { getTemplateFormOptions } from "@/features/onboarding/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";

export const metadata: Metadata = { title: "New template" };

export default async function NewTemplatePage() {
  const user = await requirePageAccess(PERMISSIONS.TEMPLATE_MANAGE);
  const { departments, documentTypes } = await getTemplateFormOptions(user);
  return (
    <>
      <PageHeader title="New template" description="Group tasks into steps, e.g. Before day one, First week." back={{ href: "/onboarding/templates", label: "Templates" }} />
      <WorkflowBuilder departments={departments} documentTypes={documentTypes} />
    </>
  );
}

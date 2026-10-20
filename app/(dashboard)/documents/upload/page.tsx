import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { UploadPanel } from "@/features/documents/components/upload-panel";
import { getDocumentChecklist, listDocumentTypes } from "@/features/documents/queries";
import { getEmployee } from "@/features/employees/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { DOCUMENT_STATUS } from "@/lib/constants/document-status";
import { PERMISSIONS } from "@/lib/constants/permissions";

export const metadata: Metadata = { title: "Upload document" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ employeeId?: string }> }) {
  const user = await requirePageAccess(PERMISSIONS.DOCUMENT_UPLOAD);
  const { employeeId: requested } = await searchParams;
  const employeeId = requested ?? user.employeeId;
  if (!employeeId) {
    return (
      <>
        <PageHeader title="Upload document" />
        <EmptyState icon={FileUp} title="Choose who it's for" description="Open an employee's profile and use Upload on their Documents tab." />
      </>
    );
  }

  const employee = await getEmployee(user, employeeId);
  if (!employee) notFound();
  const [types, checklist] = await Promise.all([listDocumentTypes(user), getDocumentChecklist(user, employeeId)]);
  const isSelf = employee.id === user.employeeId;

  return (
    <>
      <PageHeader
        title={isSelf ? "Upload a document" : `Upload for ${employee.firstName} ${employee.lastName}`}
        description="PDFs and photos of documents work best. HR reviews everything you upload."
        back={isSelf ? { href: "/documents", label: "My documents" } : { href: `/employees/${employee.id}`, label: "Back to profile" }}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <DashboardCard>
          <UploadPanel
            employeeId={employee.id}
            documentTypes={types.map((t) => ({
              id: t.id,
              name: t.name,
              hasExpiry: t.hasExpiry,
              allowedMimeTypes: t.allowedMimeTypes,
              maxSizeBytes: t.maxSizeBytes,
            }))}
          />
        </DashboardCard>
        {checklist ? (
          <DashboardCard title="Required documents" className="h-auto">
            <ul className="flex flex-col gap-2.5">
              {checklist.items.map((i) => {
                const s = i.status === "MISSING" ? { label: "Missing", tone: "neutral" as const } : DOCUMENT_STATUS[i.status];
                return (
                  <li key={i.documentType.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{i.documentType.name}</span>
                    <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          </DashboardCard>
        ) : null}
      </div>
    </>
  );
}

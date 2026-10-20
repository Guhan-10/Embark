import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Download, FileText, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExpiryBadge } from "@/features/documents/components/document-table";
import { DocumentPreview } from "@/features/documents/components/document-preview";
import { DocumentReviewActions } from "@/features/documents/components/document-review-actions";
import { getDocument } from "@/features/documents/queries";
import { isHrViewer, requirePageAccess } from "@/lib/auth/rbac";
import { DOCUMENT_STATUS } from "@/lib/constants/document-status";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentPage({ params }: { params: Promise<{ documentId: string }> }) {
  const user = await requirePageAccess(PERMISSIONS.DOCUMENT_READ);
  const { documentId } = await params;
  const doc = await getDocument(user, documentId);
  if (!doc) notFound();

  const status = DOCUMENT_STATUS[doc.status];
  const owner = `${doc.employee.firstName} ${doc.employee.lastName}`;
  const isOwn = doc.employee.userId === user.id;

  return (
    <>
      <PageHeader
        title={doc.documentType?.name ?? doc.fileName}
        description={isOwn ? undefined : owner}
        back={{ href: "/documents", label: isHrViewer(user) ? "Documents" : "My documents" }}
        actions={
          <>
            <Button variant="outline" asChild className="h-11 rounded-full bg-card px-4">
              <a href={doc.downloadUrl}>
                <Download /> Download
              </a>
            </Button>
            <DocumentReviewActions id={doc.id} canReview={doc.permissions.review} canDelete={doc.permissions.delete} />
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <DashboardCard>
          <DocumentPreview url={doc.downloadUrl} mimeType={doc.mimeType} fileName={doc.fileName} />
        </DashboardCard>
        <div className="flex flex-col gap-5">
          <DashboardCard title="Status" className="h-auto">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              <ExpiryBadge expiry={doc.expiry} />
            </div>
            {doc.status === "REJECTED" && doc.rejectionReason ? (
              <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">{doc.rejectionReason}</p>
            ) : null}
            {doc.reviewedBy ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {status.label} by {doc.reviewedBy.name} · {formatDateTime(doc.reviewedAt)}
              </p>
            ) : doc.status === "PENDING" ? (
              <p className="mt-3 text-xs text-muted-foreground">Waiting for HR to review.</p>
            ) : null}
          </DashboardCard>
          <DashboardCard title="Details" className="h-auto">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-3">
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">File</dt>
                <dd className="min-w-0 break-words">
                  {doc.fileName} · {formatFileSize(doc.fileSize)}
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Uploaded</dt>
                <dd>
                  Uploaded {formatDateTime(doc.createdAt)}
                  {doc.uploadedBy ? ` by ${doc.uploadedBy.name}` : ""}
                </dd>
              </div>
              {doc.expiryDate ? (
                <div className="flex items-center gap-3">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Expires</dt>
                  <dd>Expires {formatDate(doc.expiryDate)}</dd>
                </div>
              ) : null}
              {doc.task ? (
                <div className="border-t pt-3">
                  <dt className="text-xs text-muted-foreground">For the task</dt>
                  <dd>
                    <Link href={`/tasks/${doc.task.id}`} className="font-semibold hover:underline">
                      {doc.task.title}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </DashboardCard>
        </div>
      </div>
    </>
  );
}

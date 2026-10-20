import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { DocumentFilters } from "@/features/documents/components/document-filters";
import { DocumentTable } from "@/features/documents/components/document-table";
import { listDocuments, listDocumentTypes } from "@/features/documents/queries";
import type { DocumentListFilters } from "@/features/documents/types";
import { can, isHrViewer, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Documents" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageAccess(PERMISSIONS.DOCUMENT_READ);
  const params = await searchParams;
  const hr = isHrViewer(user);
  const canUpload = can(user, PERMISSIONS.DOCUMENT_UPLOAD);

  const [list, types] = await Promise.all([
    listDocuments(user, {
      q: one(params.q),
      status: one(params.status),
      documentTypeId: one(params.documentTypeId),
      employeeId: one(params.employeeId),
      expiringWithinDays: one(params.expiringWithinDays),
      page: one(params.page),
    } as DocumentListFilters).catch(() => null),
    canUpload ? listDocumentTypes(user) : [],
  ]);
  const filtered = Object.keys(params).some((k) => k !== "page");

  return (
    <>
      <PageHeader
        title={hr ? "Documents" : "My documents"}
        description={list ? (filtered ? plural(list.total, "match", "matches") : plural(list.total, "document")) : undefined}
        actions={
          canUpload && !hr ? (
            <Button asChild className="h-11 rounded-full px-5">
              <Link href="/documents/upload">
                <Upload /> Upload
              </Link>
            </Button>
          ) : null
        }
      />
      <DocumentFilters documentTypes={types.map((t) => ({ id: t.id, name: t.name }))} />
      {!list || list.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtered ? "No documents match those filters" : hr ? "No documents yet" : "You haven't uploaded anything yet"}
          description={filtered ? "Try different filters." : hr ? "Documents appear here as people upload them." : "Upload your ID, certificates, and forms here."}
          action={
            !filtered && canUpload && !hr ? (
              <Button asChild size="lg" className="rounded-full">
                <Link href="/documents/upload">
                  <Upload /> Upload a document
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <DocumentTable items={list.items} showEmployee={hr} />
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} basePath="/documents" searchParams={params} />
        </>
      )}
    </>
  );
}

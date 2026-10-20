import type { Metadata } from "next";
import { CalendarClock, FileCog, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableCard } from "@/components/shared/table-card";
import { DocumentTypeActions } from "@/features/settings/components/document-type-actions";
import { DocumentTypeDialog } from "@/features/settings/components/document-type-dialog";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { listDocumentTypesForSettings } from "@/features/settings/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { FILE_TYPE_NAMES } from "@/lib/constants/files";
import { PERMISSIONS } from "@/lib/constants/permissions";

export const metadata: Metadata = { title: "Document types" };

export default async function DocumentTypesPage() {
  const user = await requirePageAccess(PERMISSIONS.DOCUMENT_TYPE_MANAGE);
  const types = await listDocumentTypesForSettings(user);
  const addButton = (
    <DocumentTypeDialog
      trigger={
        <Button className="h-11 rounded-full px-5">
          <Plus /> Add document type
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title="Document types" description="What people can upload. Changes apply to new uploads only." actions={addButton} />
      <SettingsTabs user={user} />
      {types.length === 0 ? (
        <EmptyState icon={FileCog} title="No document types yet" description="Add the documents new hires need to hand in." action={addButton} />
      ) : (
        <TableCard>
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Document types</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-3.5 pr-3 pl-6 font-semibold">Document</th>
                <th scope="col" className="px-3 font-semibold">File types</th>
                <th scope="col" className="px-3 text-right font-semibold whitespace-nowrap">Max size</th>
                <th scope="col" className="px-3 font-semibold">Rules</th>
                <th scope="col" className="px-3 text-right font-semibold">Uploaded</th>
                <th scope="col" className="pr-6 pl-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <th scope="row" className="py-3 pr-3 pl-6 text-left">
                    <span className="block font-semibold">{t.name}</span>
                    {t.description ? <span className="block max-w-72 truncate text-xs font-normal text-muted-foreground">{t.description}</span> : null}
                  </th>
                  <td className="px-3 text-muted-foreground">{t.allowedMimeTypes.map((m) => FILE_TYPE_NAMES[m] ?? m).join(", ")}</td>
                  <td className="px-3 text-right tabular-nums">{t.maxSizeMb} MB</td>
                  <td className="px-3">
                    <span className="flex flex-wrap gap-1.5">
                      {t.isRequired ? <StatusBadge tone="info">Required</StatusBadge> : <StatusBadge tone="neutral">Optional</StatusBadge>}
                      {t.hasExpiry ? (
                        <StatusBadge tone="pending">
                          <CalendarClock className="mr-1 size-3" aria-hidden="true" /> Expires
                        </StatusBadge>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 text-right tabular-nums">{t.documentCount}</td>
                  <td className="pr-6 pl-3">
                    <DocumentTypeActions
                      inUse={t.documentCount > 0}
                      documentType={{
                        id: t.id,
                        name: t.name,
                        description: t.description ?? "",
                        isRequired: t.isRequired,
                        hasExpiry: t.hasExpiry,
                        allowedMimeTypes: t.allowedMimeTypes,
                        maxSizeMb: t.maxSizeMb,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </>
  );
}

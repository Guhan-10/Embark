import Link from "next/link";
import { FileImage, FileText } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableCard } from "@/components/shared/table-card";
import { DOCUMENT_STATUS } from "@/lib/constants/document-status";
import { formatFileSize, formatShortDate, formatTimeAgo } from "@/lib/utils/format";
import type { DocumentListItem } from "../types";

export function ExpiryBadge({ expiry }: { expiry: DocumentListItem["expiry"] }) {
  if (!expiry) return null;
  if (expiry.isExpired) return <StatusBadge tone="warning">Expired</StatusBadge>;
  if (expiry.isExpiringSoon) {
    return <StatusBadge tone="pending">{expiry.daysLeft === 0 ? "Expires today" : `${expiry.daysLeft} days left`}</StatusBadge>;
  }
  return null;
}

export function DocumentTable({ items, showEmployee = true }: { items: DocumentListItem[]; showEmployee?: boolean }) {
  return (
    <TableCard>
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-3.5 pr-3 pl-6 font-semibold">Document</th>
            {showEmployee ? <th scope="col" className="px-3 font-semibold">Employee</th> : null}
            <th scope="col" className="px-3 font-semibold">Uploaded</th>
            <th scope="col" className="px-3 font-semibold">Expires</th>
            <th scope="col" className="pr-6 pl-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => {
            const status = DOCUMENT_STATUS[d.status];
            const Icon = d.mimeType.startsWith("image/") ? FileImage : FileText;
            return (
              <tr key={d.id} className="group border-b last:border-0 hover:bg-muted/50">
                <td className="py-3 pr-3 pl-6">
                  <Link href={`/documents/${d.id}`} className="flex items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-ink" aria-hidden="true">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold group-hover:text-primary">{d.documentType?.name ?? "Document"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {d.fileName} · {formatFileSize(d.fileSize)}
                      </span>
                    </span>
                  </Link>
                </td>
                {showEmployee ? (
                  <td className="px-3 whitespace-nowrap">
                    {d.employee.firstName} {d.employee.lastName}
                  </td>
                ) : null}
                <td className="px-3 whitespace-nowrap">
                  {formatTimeAgo(d.createdAt)}
                  <span className="block text-xs text-muted-foreground">{d.uploadedBy?.name ?? ""}</span>
                </td>
                <td className="px-3 whitespace-nowrap">
                  {d.expiryDate ? (
                    <span className="flex flex-col items-start gap-1">
                      {formatShortDate(d.expiryDate)}
                      <ExpiryBadge expiry={d.expiry} />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="pr-6 pl-3">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}

import Link from "next/link";
import { FileSearch, FileText } from "lucide-react";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatTimeAgo } from "@/lib/utils/format";
import type { DocumentListItem } from "../types";

/** Documents waiting for HR to approve or reject, newest first. */
export function ReviewQueueCard({ items, total }: { items: DocumentListItem[]; total: number }) {
  return (
    <DashboardCard title="Documents to review" action={total > items.length ? { href: "/documents?status=PENDING", label: `All ${total}` } : undefined}>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
          <FileSearch className="mb-2 size-6" aria-hidden="true" />
          Nothing waiting for review.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((d, i) => (
            <li key={d.id}>
              <Link
                href={`/documents/${d.id}`}
                className={
                  i === 0
                    ? "block rounded-2xl bg-card p-4 shadow-raised ring-1 ring-border focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                    : "block rounded-2xl bg-muted/60 p-4 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                }
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{d.documentType?.name ?? "Document"}</span>
                  <span className="truncate">
                    {d.employee.firstName} {d.employee.lastName}
                  </span>
                </span>
                <span className="mt-2 flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{d.fileName}</span>
                  </span>
                  <StatusBadge tone="pending">Review</StatusBadge>
                </span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  Uploaded {formatTimeAgo(d.createdAt)}
                  {d.uploadedBy ? ` by ${d.uploadedBy.name}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/documents"
        className="mt-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/25 bg-accent/40 py-3 text-sm font-semibold text-primary-ink hover:border-primary/50"
      >
        Open documents
      </Link>
    </DashboardCard>
  );
}

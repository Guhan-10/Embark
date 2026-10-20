import type { Metadata } from "next";
import Link from "next/link";
import { History, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { TableCard } from "@/components/shared/table-card";
import { auditActionLabel, auditEntityHref, auditEntityLabel } from "@/features/settings/audit-labels";
import { AuditFilters } from "@/features/settings/components/audit-filters";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { getAuditFacets, listAuditLogs } from "@/features/settings/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { addDays, startOfDayInZone } from "@/lib/utils/date";
import { formatDateTime, plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Audit log" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageAccess(PERMISSIONS.AUDIT_READ);
  const params = await searchParams;
  const from = one(params.from);
  const to = one(params.to);
  const actorId = one(params.actorId);

  const [list, facets] = await Promise.all([
    listAuditLogs(user, {
      actorId,
      action: one(params.action),
      entityType: one(params.entityType),
      entityId: one(params.entityId),
      // Calendar days in the company's timezone; "to" includes the whole day.
      from: from && DATE.test(from) ? startOfDayInZone(from) : undefined,
      to: to && DATE.test(to) ? new Date(addDays(startOfDayInZone(to), 1).getTime() - 1) : undefined,
      page: Number(one(params.page)) || 1,
    }).catch(() => null),
    getAuditFacets(user),
  ]);
  const filtered = Object.keys(params).some((k) => k !== "page");
  const actorName = actorId ? list?.items.find((i) => i.actor?.id === actorId)?.actor?.name : null;
  const withoutActor = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (k === "actorId" || k === "page" || v === undefined ? [] : [[k, one(v)!]])),
  ).toString();

  return (
    <>
      <PageHeader title="Audit log" description="Every change in Embark: who made it, when, and to what. Entries can't be edited or removed." />
      <SettingsTabs user={user} />
      <AuditFilters actions={facets.actions} entityTypes={facets.entityTypes} />
      {actorId ? (
        <p className="-mt-2 mb-4">
          <Link
            href={withoutActor ? `/settings/audit?${withoutActor}` : "/settings/audit"}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-medium text-primary-ink hover:bg-accent/70"
          >
            Only {actorName ?? "this person"} <X className="size-3.5" aria-label="Show everyone" />
          </Link>
        </p>
      ) : null}
      {!list || list.items.length === 0 ? (
        <EmptyState
          icon={History}
          title={filtered ? "Nothing matches those filters" : "Nothing logged yet"}
          description={filtered ? "Try a wider date range or different filters." : "Changes appear here as people use Embark."}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{plural(list.total, "entry", "entries")}</p>
          <TableCard>
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Audit log</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-3.5 pr-3 pl-6 font-semibold">When</th>
                  <th scope="col" className="px-3 font-semibold">Who</th>
                  <th scope="col" className="px-3 font-semibold">What</th>
                  <th scope="col" className="px-3 font-semibold">Record</th>
                  <th scope="col" className="pr-6 pl-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((log) => {
                  const href = auditEntityHref(log.entityType, log.entityId);
                  const hasMetadata = log.metadata && typeof log.metadata === "object" && Object.keys(log.metadata).length > 0;
                  return (
                    <tr key={log.id} className="border-b align-top last:border-0">
                      <td className="py-3 pr-3 pl-6 whitespace-nowrap text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                      <td className="px-3 py-3">
                        {log.actor?.id ? (
                          <Link
                            href={`/settings/audit?actorId=${encodeURIComponent(log.actor.id)}`}
                            className="font-medium hover:text-primary"
                            title={`Show only ${log.actor.name}'s changes`}
                          >
                            {log.actor.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{log.actor?.name ?? "Deleted user"}</span>
                        )}
                        {log.actor?.email ? <span className="block text-xs text-muted-foreground">{log.actor.email}</span> : null}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium">{auditActionLabel(log.action)}</span>
                        <code className="block text-xs text-muted-foreground">{log.action}</code>
                      </td>
                      <td className="px-3 py-3">
                        <span className="block">{auditEntityLabel(log.entityType)}</span>
                        {log.entityId ? (
                          href ? (
                            <Link href={href} className="font-mono text-xs text-primary-ink underline-offset-4 hover:underline">
                              {log.entityId.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground" title={log.entityId}>
                              {log.entityId.slice(0, 8)}
                            </span>
                          )
                        ) : null}
                      </td>
                      <td className="max-w-80 pr-6 pl-3 py-3">
                        {hasMetadata ? (
                          <details>
                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Show details</summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-muted p-3 text-xs whitespace-pre-wrap">{JSON.stringify(log.metadata, null, 2)}</pre>
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {log.ipAddress ? <span className="mt-1 block text-xs text-muted-foreground">IP {log.ipAddress}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableCard>
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} basePath="/settings/audit" searchParams={params} />
        </>
      )}
    </>
  );
}

"use client";

import { ListFilters } from "@/components/shared/list-filters";
import { DOCUMENT_STATUS } from "@/lib/constants/document-status";

export function DocumentFilters({ documentTypes }: { documentTypes: { id: string; name: string }[] }) {
  return (
    <ListFilters
      searchLabel="Search by file name"
      selects={[
        { param: "status", label: "Status", options: Object.entries(DOCUMENT_STATUS).map(([value, s]) => ({ value, label: s.label })) },
        { param: "documentTypeId", label: "Type", options: documentTypes.map((t) => ({ value: t.id, label: t.name })) },
        { param: "expiringWithinDays", label: "Expiry", options: [{ value: "30", label: "Expiring in 30 days" }, { value: "7", label: "Expiring in 7 days" }] },
      ]}
    />
  );
}

"use client";

import { ListFilters } from "@/components/shared/list-filters";

export function UserFilters({ roles }: { roles: { key: string; name: string }[] }) {
  return (
    <ListFilters
      searchLabel="Search by name, email, or code"
      selects={[
        { param: "roleKey", label: "Role", options: roles.map((r) => ({ value: r.key, label: r.name })) },
        {
          param: "active",
          label: "Login",
          options: [
            { value: "true", label: "On" },
            { value: "false", label: "Turned off" },
          ],
        },
      ]}
    />
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { TableCard } from "@/components/shared/table-card";
import { plural } from "@/lib/utils/format";
import { setRolePermissionsAction } from "../actions";
import type { RoleSettings } from "../types";

const GROUPS: { label: string; prefixes: string[] }[] = [
  { label: "People", prefixes: ["employee", "department"] },
  { label: "Onboarding", prefixes: ["onboarding", "template"] },
  { label: "Tasks", prefixes: ["task"] },
  { label: "Documents", prefixes: ["document", "document_type"] },
  { label: "Reports", prefixes: ["report"] },
  { label: "Administration", prefixes: ["user", "role", "audit"] },
];

const sameSet = (a: string[], b: Set<string>) => a.length === b.size && a.every((k) => b.has(k));

/**
 * Roles across, permissions down. HR Admin always has everything, and the admin-only permissions can't be
 * given to anyone else, so those boxes are locked. Changes are saved together.
 */
export function RolePermissionGrid({ roles, permissions }: RoleSettings) {
  const initial = useMemo(() => Object.fromEntries(roles.map((r) => [r.key, new Set(r.permissionKeys)])), [roles]);
  const [draft, setDraft] = useState<Record<string, Set<string>>>(initial);
  const [pending, startTransition] = useTransition();

  const changed = roles.filter((r) => r.editable && !sameSet(r.permissionKeys, draft[r.key]));
  const groups = GROUPS.map((g) => ({
    ...g,
    permissions: permissions.filter((p) => g.prefixes.includes(p.key.split(":")[0])),
  })).filter((g) => g.permissions.length);

  const toggle = (roleKey: string, permissionKey: string, on: boolean) =>
    setDraft((d) => {
      const next = new Set(d[roleKey]);
      if (on) next.add(permissionKey);
      else next.delete(permissionKey);
      return { ...d, [roleKey]: next };
    });

  const save = () =>
    startTransition(async () => {
      for (const role of changed) {
        const result = await setRolePermissionsAction(role.key, { permissionKeys: [...draft[role.key]] });
        if (!result.ok) {
          toast.error(`${role.name}: ${result.error}`);
          return;
        }
      }
      toast.success(changed.length === 1 ? `${changed[0].name} updated` : `${changed.length} roles updated`);
    });

  return (
    <>
      <TableCard>
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Permissions for each role</caption>
          <thead>
            <tr className="border-b align-bottom">
              <th scope="col" className="py-4 pr-3 pl-6 text-left text-xs font-semibold text-muted-foreground">
                Permission
              </th>
              {roles.map((r) => (
                <th key={r.key} scope="col" className="w-36 px-3 py-4 text-center">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{plural(r.userCount, "person", "people")}</span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.label}>
              <tr className="bg-muted/50">
                <th scope="colgroup" colSpan={roles.length + 1} className="py-2 pl-6 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {g.label}
                </th>
              </tr>
              {g.permissions.map((p) => (
                <tr key={p.key} className="border-b last:border-0">
                  <th scope="row" className="py-3 pr-3 pl-6 text-left font-medium">
                    <span className="flex items-center gap-1.5">
                      {p.description}
                      {p.adminOnly ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-soft px-2 py-0.5 text-[11px] font-semibold text-neutral-ink">
                          <Lock className="size-3" aria-hidden="true" /> HR Admin only
                        </span>
                      ) : null}
                    </span>
                    <code className="text-xs font-normal text-muted-foreground">{p.key}</code>
                  </th>
                  {roles.map((r) => {
                    const locked = !r.editable || p.adminOnly;
                    return (
                      <td key={r.key} className="px-3 text-center">
                        <Checkbox
                          className="mx-auto size-5"
                          checked={!r.editable || draft[r.key].has(p.key)}
                          disabled={locked || pending}
                          onCheckedChange={(v) => toggle(r.key, p.key, v === true)}
                          aria-label={`${r.name}: ${p.description}`}
                          title={!r.editable ? "HR Admins always have every permission" : p.adminOnly ? "Only HR Admins can have this" : undefined}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </TableCard>

      <div
        className="sticky bottom-4 z-10 mt-5 flex flex-col gap-3 rounded-full bg-card p-2 pl-5 shadow-lg ring-1 ring-border sm:flex-row sm:items-center sm:justify-between data-[hidden=true]:hidden"
        data-hidden={changed.length === 0}
        role="status"
      >
        <p className="text-sm">
          Unsaved changes to <span className="font-semibold">{changed.map((r) => r.name).join(", ")}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" className="h-11 rounded-full px-5" disabled={pending} onClick={() => setDraft(initial)}>
            Undo
          </Button>
          <Button className="h-11 rounded-full px-6" disabled={pending} onClick={save}>
            {pending ? <LoadingSpinner label="Saving" /> : null}
            Save changes
          </Button>
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, UserRoundCheck, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { plural } from "@/lib/utils/format";
import {
  createDesignationAction,
  deleteDepartmentAction,
  deleteDesignationAction,
  renameDesignationAction,
  setDepartmentHrAction,
} from "../actions";
import type { DepartmentSettings } from "../types";
import { DepartmentDialog } from "./department-dialog";

type Department = DepartmentSettings[number];
type HrCandidate = { id: string; name: string; employeeCode: string; isRegistered: boolean };

const NONE = "none";

/** One department: its details, its HR, and its designations. */
export function DepartmentCard({ department, hrCandidates }: { department: Department; hrCandidates: HrCandidate[] | null }) {
  return (
    <DashboardCard
      className="h-auto"
      title={
        <span className="flex flex-wrap items-center gap-2">
          {department.name}
          {department.code ? <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">{department.code}</span> : null}
        </span>
      }
      action={
        <div className="flex gap-1">
          <DepartmentDialog
            department={{ id: department.id, name: department.name, code: department.code ?? "", description: department.description ?? "" }}
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Edit ${department.name}`} title="Edit">
                <Pencil />
              </Button>
            }
          />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full text-danger-ink hover:text-danger-ink" aria-label={`Delete ${department.name}`} title="Delete">
                <Trash2 />
              </Button>
            }
            title={`Delete ${department.name}?`}
            description={
              department.headCount
                ? `${plural(department.headCount, "person is", "people are")} still in ${department.name}. Move them to another department first.`
                : "Its designations are deleted too. This can't be undone."
            }
            confirmLabel="Delete department"
            destructive
            onConfirm={() => deleteDepartmentAction(department.id)}
            successMessage={`${department.name} deleted`}
          />
        </div>
      }
    >
      {department.description ? <p className="-mt-1 mb-4 text-sm text-muted-foreground">{department.description}</p> : null}
      <p className="mb-4 text-sm">
        <span className="font-semibold">{plural(department.headCount, "person", "people")}</span>
        <span className="text-muted-foreground"> in this department</span>
      </p>
      <DepartmentHr department={department} candidates={hrCandidates} />
      <Designations department={department} />
    </DashboardCard>
  );
}

/** Choosing a department's HR moves everyone in it into that HR's space, so it asks first. */
function DepartmentHr({ department, candidates }: { department: Department; candidates: HrCandidate[] | null }) {
  const [next, setNext] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = department.hr?.employeeId ?? NONE;
  const nextName = next && next !== NONE ? candidates?.find((c) => c.id === next)?.name : null;

  const confirm = () =>
    startTransition(async () => {
      const result = await setDepartmentHrAction(department.id, next === NONE ? null : next);
      if (!result.ok) return void toast.error(result.error);
      toast.success(nextName ? `${nextName} now looks after ${department.name}` : `${department.name} has no HR now`);
      setNext(null);
    });

  return (
    <div className="mb-5 rounded-2xl bg-accent/50 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary-ink">
        <UserRoundCheck className="size-4" aria-hidden="true" /> Department HR
      </p>
      {candidates ? (
        <Select value={current} onValueChange={(v) => v !== current && setNext(v)} disabled={pending}>
          <SelectTrigger aria-label={`HR for ${department.name}`} className="w-full rounded-xl bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No HR yet</SelectItem>
            {candidates.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {c.employeeCode}
                {c.isRegistered ? "" : " (hasn't signed up)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm font-medium">{department.hr?.name ?? "No HR yet"}</p>
      )}
      {department.hr && !department.hr.isRegistered ? (
        <p className="mt-2 text-xs text-muted-foreground">{department.hr.name} hasn&apos;t signed up yet, so their tasks wait until they do.</p>
      ) : null}

      <AlertDialog open={next !== null} onOpenChange={(open) => !open && !pending && setNext(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{nextName ? `Make ${nextName} HR for ${department.name}?` : `Remove ${department.name}'s HR?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {nextName
                ? `Everyone in ${department.name} (${plural(department.headCount, "person", "people")}) moves into ${nextName}'s space, and their open HR tasks are reassigned to ${nextName}.`
                : "People keep their current HR manager until a new department HR is chosen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button onClick={confirm} disabled={pending}>
              {pending ? <LoadingSpinner label="Saving" /> : null}
              {nextName ? "Change HR" : "Remove HR"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Designations({ department }: { department: Department }) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = await createDesignationAction({ departmentId: department.id, title });
      if (!result.ok) return void toast.error(result.fieldErrors?.title?.[0] ?? result.error);
      setTitle("");
    });

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Designations</p>
      {department.designations.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">None yet.</p>
      ) : (
        <ul className="mb-3 flex flex-col divide-y rounded-2xl ring-1 ring-border">
          {department.designations.map((d) => (
            <DesignationRow key={d.id} designation={d} />
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add();
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New designation"
          aria-label={`New designation in ${department.name}`}
          className="h-10 rounded-full bg-card px-4"
          maxLength={80}
        />
        <Button type="submit" variant="outline" className="h-10 shrink-0 rounded-full bg-card px-4" disabled={pending || !title.trim()}>
          {pending ? <LoadingSpinner label="Adding" /> : <Plus />} Add
        </Button>
      </form>
    </div>
  );
}

function DesignationRow({ designation }: { designation: Department["designations"][number] }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(designation.title);
  const [pending, startTransition] = useTransition();

  const rename = () =>
    startTransition(async () => {
      const result = await renameDesignationAction(designation.id, title);
      if (!result.ok) return void toast.error(result.error);
      setEditing(false);
    });

  return (
    <li className="flex min-h-12 items-center gap-2 py-1.5 pr-1.5 pl-4 text-sm">
      {editing ? (
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            rename();
          }}
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Designation title"
            className="h-9 rounded-full px-3"
            autoFocus
            maxLength={80}
            onKeyDown={(e) => e.key === "Escape" && (setEditing(false), setTitle(designation.title))}
          />
          <Button type="submit" variant="ghost" size="icon" className="rounded-full" aria-label="Save" disabled={pending || !title.trim()}>
            {pending ? <LoadingSpinner /> : <Check />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label="Cancel" onClick={() => (setEditing(false), setTitle(designation.title))}>
            <X />
          </Button>
        </form>
      ) : (
        <>
          <span className="flex-1 font-medium">{designation.title}</span>
          <span className="text-xs text-muted-foreground">{plural(designation.headCount, "person", "people")}</span>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Rename ${designation.title}`} title="Rename" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full text-danger-ink hover:text-danger-ink" aria-label={`Delete ${designation.title}`} title="Delete">
                <Trash2 />
              </Button>
            }
            title={`Delete ${designation.title}?`}
            description={designation.headCount ? "People still have this designation. Change theirs first." : "This can't be undone."}
            confirmLabel="Delete"
            destructive
            onConfirm={() => deleteDesignationAction(designation.id)}
            successMessage={`${designation.title} deleted`}
          />
        </>
      )}
    </li>
  );
}

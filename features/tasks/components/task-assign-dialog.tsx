"use client";

import { useState, useTransition } from "react";
import { UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { assignTaskAction } from "../actions";

/** HR picks who a task goes to. Hand-picked assignees aren't changed automatically later. */
export function TaskAssignDialog({
  taskId,
  current,
  people,
}: {
  taskId: string;
  current: string[];
  people: { id: string; name: string; hint?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await assignTaskAction(taskId, { userIds: selected });
      if (!result.ok) return setError(result.error);
      toast.success(selected.length ? "Assignees updated. New assignees were notified." : "Task unassigned");
      setOpen(false);
    });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && (setOpen(next), next && setSelected(current))}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 rounded-full bg-card px-4">
          <UserRoundCog /> Reassign
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Who does this task?</DialogTitle>
          <DialogDescription>Only people involved in this onboarding can be picked.</DialogDescription>
        </DialogHeader>
        <ErrorMessage message={error} />
        <div className="flex flex-col gap-2 rounded-2xl border p-3">
          {people.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 text-sm hover:bg-muted">
              <Checkbox
                checked={selected.includes(p.id)}
                onCheckedChange={(c) => setSelected((s) => (c ? [...s, p.id] : s.filter((id) => id !== p.id)))}
              />
              <span>
                <span className="font-medium">{p.name}</span>
                {p.hint ? <span className="block text-xs text-muted-foreground">{p.hint}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11 rounded-full" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button className="h-11 rounded-full px-6" onClick={save} disabled={pending}>
            {pending ? <LoadingSpinner /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

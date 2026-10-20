"use client";

import { useState, useTransition } from "react";
import { Ban, CheckCircle2, Play, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import type { TaskStatus } from "@/generated/prisma/enums";
import { TASK_STATUS } from "@/lib/constants/task-status";
import { changeTaskStatusAction } from "../actions";

type Move = { to: TaskStatus; label: string; icon: typeof Play; primary?: boolean; needsNote?: boolean };

/** The status buttons that make sense from where the task is now. Blocking and skipping ask for a note. */
export function TaskStatusControl({
  taskId,
  status,
  canSkip,
  needsDocument,
}: {
  taskId: string;
  status: TaskStatus;
  canSkip: boolean;
  /** Document tasks are completed by uploading, not by a button. */
  needsDocument: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [noteFor, setNoteFor] = useState<Move | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const done: Move = { to: "DONE", label: "Mark done", icon: CheckCircle2, primary: true };
  const block: Move = { to: "BLOCKED", label: "Blocked…", icon: Ban, needsNote: true };
  const skip: Move = { to: "SKIPPED", label: "Skip…", icon: SkipForward, needsNote: true };
  const moves: Move[] =
    status === "TODO"
      ? [{ to: "IN_PROGRESS", label: "Start", icon: Play, primary: needsDocument }, ...(needsDocument ? [] : [done]), block]
      : status === "IN_PROGRESS"
        ? [...(needsDocument ? [] : [done]), block, { to: "TODO", label: "Back to to-do", icon: RotateCcw }]
        : status === "BLOCKED"
          ? [{ to: "IN_PROGRESS", label: "Unblock", icon: Play, primary: needsDocument }, ...(needsDocument ? [] : [done])]
          : [{ to: "TODO", label: "Reopen", icon: RotateCcw }];
  if (canSkip && status !== "SKIPPED" && status !== "DONE") moves.push(skip);

  const run = (move: Move, withNote?: string) =>
    startTransition(async () => {
      setError(null);
      const result = await changeTaskStatusAction(taskId, { status: move.to, note: withNote });
      if (!result.ok) {
        if (noteFor) setError(result.fieldErrors?.note?.[0] ?? result.error);
        else toast.error(result.error);
        return;
      }
      setNoteFor(null);
      setNote("");
      toast.success(`Marked ${TASK_STATUS[move.to].label.toLowerCase()}`);
    });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {moves.map((m) => (
          <Button
            key={m.to}
            variant={m.primary ? "default" : "outline"}
            className="h-11 rounded-full px-4"
            disabled={pending}
            onClick={() => (m.needsNote ? setNoteFor(m) : run(m))}
          >
            {pending && !m.needsNote ? <LoadingSpinner /> : <m.icon />}
            {m.label}
          </Button>
        ))}
      </div>

      <Dialog open={Boolean(noteFor)} onOpenChange={(open) => !open && !pending && setNoteFor(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{noteFor?.to === "SKIPPED" ? "Skip this task?" : "What's blocking it?"}</DialogTitle>
            <DialogDescription>
              {noteFor?.to === "SKIPPED"
                ? "Skipped tasks count as finished. Say why, for the record."
                : "Your HR is told, with this note, so they can help."}
            </DialogDescription>
          </DialogHeader>
          <ErrorMessage message={error} />
          <Textarea
            aria-label="Note"
            rows={3}
            className="rounded-xl"
            placeholder={noteFor?.to === "SKIPPED" ? "Collected on paper" : "Waiting for the laptop to arrive"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-full" onClick={() => setNoteFor(null)} disabled={pending}>
              Cancel
            </Button>
            <Button className="h-11 rounded-full px-5" disabled={pending} onClick={() => noteFor && run(noteFor, note)}>
              {pending ? <LoadingSpinner /> : null}
              {noteFor?.to === "SKIPPED" ? "Skip task" : "Mark blocked"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { changeTaskStatusAction } from "../actions";

/** A round checkbox that marks a task done (or reopens it) without leaving the page. */
export function TaskQuickToggle({ taskId, title, done }: { taskId: string; title: string; done: boolean }) {
  const [pending, startTransition] = useTransition();
  const toggle = () =>
    startTransition(async () => {
      const result = await changeTaskStatusAction(taskId, { status: done ? "TODO" : "DONE" });
      if (!result.ok) toast.error(result.error);
      else if (!done) toast.success(`Done: ${title}`);
    });

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Reopen "${title}"` : `Mark "${title}" done`}
      onClick={toggle}
      disabled={pending}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60",
        done ? "border-success bg-success text-success-foreground" : "border-input bg-card hover:border-primary",
      )}
    >
      {done || pending ? <Check className={cn("size-3.5", pending && !done && "text-primary")} strokeWidth={3} /> : null}
    </button>
  );
}

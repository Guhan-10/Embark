import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** An inline error box, e.g. at the top of a form when the server rejects it. */
export function ErrorMessage({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-2 rounded-lg border border-destructive/30 bg-danger-soft px-3 py-2.5 text-sm text-danger-ink", className)}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

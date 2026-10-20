import { cn } from "@/lib/utils/cn";

/** A white rounded card that holds a table and scrolls sideways on small screens. */
export function TableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[1.75rem] bg-card shadow-card", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

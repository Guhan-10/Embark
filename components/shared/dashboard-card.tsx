import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type DashboardCardProps = {
  title?: React.ReactNode;
  /** Small link or button on the right of the title, e.g. "View all". */
  action?: { href: string; label: string; icon?: React.ReactNode } | React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

function isLinkAction(action: DashboardCardProps["action"]): action is { href: string; label: string; icon?: React.ReactNode } {
  return typeof action === "object" && action !== null && "href" in action;
}

/** The rounded white panel the dashboard is built from. */
export function DashboardCard({ title, action, children, className }: DashboardCardProps) {
  return (
    <section aria-label={typeof title === "string" ? title : undefined} className={cn("flex h-full flex-col rounded-[1.75rem] bg-card p-5 shadow-card sm:p-6", className)}>
      {title || action ? (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-bold tracking-tight">{title}</h2> : <span />}
          {isLinkAction(action) ? (
            <Link href={action.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              {action.icon}
              {action.label}
            </Link>
          ) : (
            action
          )}
        </header>
      ) : null}
      {children}
    </section>
  );
}

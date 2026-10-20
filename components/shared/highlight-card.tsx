import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** The one bold teal card on a dashboard: a headline number or message and a single next step. */
export function HighlightCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative flex flex-col items-center overflow-hidden rounded-[1.75rem] bg-highlight p-6 text-center text-white shadow-highlight", className)}>
      <span aria-hidden="true" className="absolute -top-10 -right-10 size-32 rounded-full bg-white/10" />
      <span aria-hidden="true" className="absolute -bottom-12 -left-8 size-36 rounded-full bg-sky/15" />
      <span className="relative mt-2 flex size-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30" aria-hidden="true">
        <Icon className="size-8 text-brand-mint" />
      </span>
      {eyebrow ? <p className="relative mt-4 text-xs font-semibold tracking-wide text-brand-mint uppercase">{eyebrow}</p> : null}
      <h2 className="relative mt-2 text-xl leading-snug font-bold">{title}</h2>
      {description ? <p className="relative mt-2 text-sm text-white/85">{description}</p> : null}
      {children}
      {action ? (
        <div className="relative mt-auto pt-5">
          <Link
            href={action.href}
            className="inline-flex h-11 items-center rounded-full bg-primary-strong px-6 text-sm font-semibold text-primary-strong-foreground shadow-lg hover:bg-primary-strong/90 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            {action.label}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

import Link from "next/link";
import { Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tone = "mint" | "sky" | "sun" | "teal";

const TONES: Record<Tone, { panel: string; icon: string; dot: string }> = {
  mint: { panel: "bg-mint", icon: "bg-card text-success-ink", dot: "bg-success/30" },
  sky: { panel: "bg-sky", icon: "bg-card text-info-ink", dot: "bg-card/60" },
  sun: { panel: "bg-sun", icon: "bg-card text-pending-ink", dot: "bg-card/60" },
  teal: { panel: "bg-accent", icon: "bg-card text-primary", dot: "bg-primary/20" },
};

/** An illustrated shortcut card: a coloured scene with the icon, then a title and one line of help. */
export function QuickActionTile({
  href,
  icon: Icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: Tone;
}) {
  const t = TONES[tone];
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[1.75rem] bg-card p-3 shadow-card transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className={cn("relative flex h-20 items-center justify-center overflow-hidden rounded-[1.25rem] sm:h-28", t.panel)} aria-hidden="true">
        <span className={cn("absolute -top-4 -left-4 size-16 rounded-full", t.dot)} />
        <span className={cn("absolute right-5 bottom-3 size-6 rounded-full", t.dot)} />
        <span className={cn("absolute top-4 right-10 size-3 rounded-full", t.dot)} />
        <span className={cn("relative flex size-14 items-center justify-center rounded-2xl shadow-md transition-transform group-hover:scale-105", t.icon)}>
          <Icon className="size-7" />
        </span>
      </div>
      <div className="px-2 pt-3 pb-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

/** The dashed "add" tile. */
export function AddTile({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-[1.75rem] border-2 border-dashed border-primary/30 bg-accent/40 p-4 text-sm font-semibold text-primary-ink transition-colors hover:border-primary/60 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
        <Plus className="size-5" aria-hidden="true" />
      </span>
      {label}
    </Link>
  );
}

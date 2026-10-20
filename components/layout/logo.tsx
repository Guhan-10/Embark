import { cn } from "@/lib/utils/cn";

/** The Embark mark on its own. `tone="light"` is for teal backgrounds. */
export function LogoMark({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <rect width="64" height="64" rx="18" fill={tone === "light" ? "#d3fcdc" : "#007c81"} />
      <path
        d="M17 41 32 18l15 23"
        fill="none"
        stroke={tone === "light" ? "#007c81" : "#d3fcdc"}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M23 47h18" stroke={tone === "light" ? "#004d52" : "#afdbff"} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** The mark plus the wordmark. */
export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark tone={tone} />
      <span className={cn("text-lg font-bold tracking-tight", tone === "light" ? "text-white" : "text-foreground")}>
        Embark
      </span>
    </span>
  );
}

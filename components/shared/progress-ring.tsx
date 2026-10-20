import { cn } from "@/lib/utils/cn";

type ProgressRingProps = {
  value: number;
  size?: number;
  stroke?: number;
  /** Ring colour, as a CSS colour or var(). */
  color?: string;
  label?: React.ReactNode;
  className?: string;
};

/** A circular percentage, e.g. "90%" inside a teal ring. */
export function ProgressRing({ value, size = 64, stroke = 6, color = "var(--primary)", label, className }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="img"
      aria-label={`${clamped}%`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute text-sm font-bold">{label ?? `${clamped}%`}</span>
    </div>
  );
}

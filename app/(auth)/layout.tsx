import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const POINTS = [
  "Every task for your first days in one place",
  "Upload documents securely, once",
  "See what's done and what's next",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-highlight p-10 text-white lg:flex lg:flex-col">
        <div aria-hidden="true" className="absolute -right-24 -bottom-24 size-96 rounded-full bg-sky/20" />
        <div aria-hidden="true" className="absolute top-1/3 -right-10 size-40 rounded-full bg-mint/20" />
        <Logo tone="light" />
        <div className="relative my-auto max-w-md">
          <h2 className="text-4xl leading-tight font-bold tracking-tight">Every first day, ready before it starts.</h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3 text-sky-50">
                <CheckCircle2 className="size-5 shrink-0 text-brand-mint" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">Embark · Team AURA</p>
      </aside>
      <main className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <ThemeToggle className="absolute top-4 right-4 size-10 rounded-full border bg-card shadow-xs" />
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}

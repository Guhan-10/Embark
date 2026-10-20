import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvalidLink({ title, description, action }: { title: string; description: string; action: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-center">
      <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-warning-soft text-warning-ink">
        <LinkIcon className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Button size="lg" variant="outline" asChild className="mt-4">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    </div>
  );
}

import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="This page doesn't exist, or you don't have access to it."
        action={
          <Button size="lg" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        }
        className="w-full max-w-md"
      />
    </main>
  );
}

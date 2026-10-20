"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="This page didn't load"
      description="Something went wrong on our side. Try again, and if it keeps happening, let your HR Admin know."
      action={
        <Button size="lg" onClick={reset}>
          <RefreshCw /> Try again
        </Button>
      }
    />
  );
}

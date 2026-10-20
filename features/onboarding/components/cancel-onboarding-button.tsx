"use client";

import { useRouter } from "next/navigation";
import { CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cancelOnboardingAction } from "../actions";

export function CancelOnboardingButton({ processId, name }: { processId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="h-11 rounded-full bg-card px-4">
          <CircleX /> Cancel onboarding
        </Button>
      }
      title={`Cancel ${name}'s onboarding?`}
      description="Their open tasks are hidden and can't be changed. Everything done so far is kept, and you can start onboarding again later."
      confirmLabel="Cancel onboarding"
      destructive
      successMessage="Onboarding cancelled"
      onConfirm={async () => {
        const result = await cancelOnboardingAction(processId);
        if (result.ok) router.refresh();
        return result;
      }}
    />
  );
}

"use client";

import { useOptimistic, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { setTemplateActiveAction } from "../actions";

/** Turns a template on or off. Off templates can't be used to start new onboarding. */
export function TemplateActiveSwitch({ id, name, isActive }: { id: string; name: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useOptimistic(isActive);
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Switch
        checked={active}
        disabled={pending}
        aria-label={`${name} is ${active ? "in use" : "turned off"}`}
        onCheckedChange={(next) =>
          startTransition(async () => {
            setActive(next);
            const result = await setTemplateActiveAction(id, next);
            if (!result.ok) toast.error(result.error);
            else toast.success(next ? `"${name}" can be used again` : `"${name}" turned off`);
          })
        }
      />
      {active ? "In use" : "Off"}
    </label>
  );
}

"use client";

import { LogOut, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { revokeUserSessionsAction, setUserActiveAction } from "../actions";

/** Turn a login off or on, or sign someone out on every device. */
export function UserActions({ user }: { user: { id: string; name: string; isActive: boolean; isSelf: boolean; archived: boolean } }) {
  if (user.isSelf) return <span className="text-xs text-muted-foreground">That&apos;s you</span>;
  return (
    <div className="flex justify-end gap-1">
      {user.isActive ? (
        <>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Sign ${user.name} out everywhere`} title="Sign out everywhere">
                <LogOut />
              </Button>
            }
            title={`Sign ${user.name} out everywhere?`}
            description="They're signed out on every device, for example after a lost laptop. They can sign straight back in."
            confirmLabel="Sign out everywhere"
            onConfirm={() => revokeUserSessionsAction(user.id)}
            successMessage={`${user.name} is signed out everywhere`}
          />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full text-danger-ink hover:text-danger-ink" aria-label={`Turn off ${user.name}'s login`} title="Turn off login">
                <PowerOff />
              </Button>
            }
            title={`Turn off ${user.name}'s login?`}
            description="They're signed out now and can't sign in until you turn it back on. Their records and tasks stay as they are."
            confirmLabel="Turn off login"
            destructive
            onConfirm={() => setUserActiveAction(user.id, false)}
            successMessage={`${user.name} can no longer sign in`}
          />
        </>
      ) : user.archived ? (
        <span className="text-xs text-muted-foreground">Restore their employee record first</span>
      ) : (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="h-9 rounded-full bg-card px-4">
              <Power /> Turn on
            </Button>
          }
          title={`Turn ${user.name}'s login back on?`}
          description="They can sign in again with their existing password."
          confirmLabel="Turn on login"
          onConfirm={() => setUserActiveAction(user.id, true)}
          successMessage={`${user.name} can sign in again`}
        />
      )}
    </div>
  );
}

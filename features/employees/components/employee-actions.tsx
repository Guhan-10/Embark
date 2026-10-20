"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Mail, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { archiveEmployeeAction, resendWelcomeEmailAction, restoreEmployeeAction } from "../actions";

const pill = "h-11 rounded-full bg-card px-4";

/** Profile actions, shown only when this user is allowed to use them. */
export function EmployeeActions({
  id,
  name,
  isArchived,
  canEdit,
  canArchive,
  canResend,
}: {
  id: string;
  name: string;
  isArchived: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canResend: boolean;
}) {
  const [sending, startSending] = useTransition();

  const resend = () =>
    startSending(async () => {
      const result = await resendWelcomeEmailAction(id);
      if (result.ok) toast.success(`Sent ${name} a new sign-up link. The old one no longer works.`);
      else toast.error(result.error);
    });

  return (
    <>
      {canResend && !isArchived ? (
        <Button variant="outline" className={pill} onClick={resend} disabled={sending}>
          {sending ? <LoadingSpinner label="Sending" /> : <Mail />} Resend welcome email
        </Button>
      ) : null}
      {canArchive ? (
        isArchived ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" className={pill}>
                <ArchiveRestore /> Restore
              </Button>
            }
            title={`Restore ${name}?`}
            description="Their login works again (if they had one). Onboarding has to be started again if they still need it."
            confirmLabel="Restore"
            onConfirm={() => restoreEmployeeAction(id)}
            successMessage={`${name} restored`}
          />
        ) : (
          <ConfirmDialog
            trigger={
              <Button variant="outline" className={pill}>
                <Archive /> Archive
              </Button>
            }
            title={`Archive ${name}?`}
            description="They'll be signed out and can't log in, and any onboarding in progress is cancelled. Their records are kept, and you can restore them later."
            confirmLabel="Archive"
            destructive
            onConfirm={() => archiveEmployeeAction(id)}
            successMessage={`${name} archived`}
          />
        )
      ) : null}
      {canEdit ? (
        <Button asChild className="h-11 rounded-full px-5">
          <Link href={`/employees/${id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      ) : null}
    </>
  );
}

/** A small Restore button for rows in the archived list. */
export function RestoreButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" className="rounded-full">
          <ArchiveRestore /> Restore
        </Button>
      }
      title={`Restore ${name}?`}
      description="Their login works again (if they had one). Onboarding has to be started again if they still need it."
      confirmLabel="Restore"
      onConfirm={() => restoreEmployeeAction(id)}
      successMessage={`${name} restored`}
    />
  );
}

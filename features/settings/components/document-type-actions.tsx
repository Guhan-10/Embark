"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteDocumentTypeAction } from "../actions";
import { DocumentTypeDialog, type DocumentTypeValues } from "./document-type-dialog";

export function DocumentTypeActions({ documentType, inUse }: { documentType: { id: string } & DocumentTypeValues; inUse: boolean }) {
  return (
    <div className="flex justify-end gap-1">
      <DocumentTypeDialog
        documentType={documentType}
        trigger={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Edit ${documentType.name}`} title="Edit">
            <Pencil />
          </Button>
        }
      />
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon" className="rounded-full text-danger-ink hover:text-danger-ink" aria-label={`Delete ${documentType.name}`} title="Delete">
            <Trash2 />
          </Button>
        }
        title={`Delete ${documentType.name}?`}
        description={
          inUse
            ? "People have already uploaded this, so it can't be deleted. Turn off \"Required for everyone\" instead."
            : "This can't be undone. Templates or tasks that use it will stop it from being deleted."
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteDocumentTypeAction(documentType.id)}
        successMessage={`${documentType.name} deleted`}
      />
    </div>
  );
}

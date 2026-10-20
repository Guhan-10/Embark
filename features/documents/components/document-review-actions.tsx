"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { deleteDocumentAction, reviewDocumentAction } from "../actions";

/** Approve, reject with a reason, or remove a document — whichever this user may do. */
export function DocumentReviewActions({ id, canReview, canDelete }: { id: string; canReview: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const review = (decision: "APPROVE" | "REJECT") =>
    startTransition(async () => {
      setError(null);
      const result = await reviewDocumentAction(id, { decision, reason: decision === "REJECT" ? reason : undefined });
      if (!result.ok) {
        if (decision === "REJECT") return setError(result.fieldErrors?.reason?.[0] ?? result.error);
        return void toast.error(result.error);
      }
      setRejecting(false);
      toast.success(decision === "APPROVE" ? "Approved" : "Rejected. They've been told why and can upload again.");
    });

  return (
    <div className="flex flex-wrap gap-2">
      {canReview ? (
        <>
          <Button className="h-11 rounded-full px-5" onClick={() => review("APPROVE")} disabled={pending}>
            {pending && !rejecting ? <LoadingSpinner /> : <CheckCircle2 />} Approve
          </Button>
          <Button variant="outline" className="h-11 rounded-full bg-card px-5" onClick={() => setRejecting(true)} disabled={pending}>
            <XCircle /> Reject…
          </Button>
        </>
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="h-11 rounded-full bg-card px-4">
              <Trash2 /> Remove
            </Button>
          }
          title="Remove this document?"
          description="It disappears from Embark (the file is kept for the audit trail). If it completed a task, the task reopens."
          confirmLabel="Remove"
          destructive
          successMessage="Document removed"
          onConfirm={async () => {
            const result = await deleteDocumentAction(id);
            if (result.ok) router.push("/documents");
            return result;
          }}
        />
      ) : null}

      <Dialog open={rejecting} onOpenChange={(open) => !pending && setRejecting(open)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this document?</DialogTitle>
            <DialogDescription>Tell them what to fix. They&apos;ll see this note and their task reopens.</DialogDescription>
          </DialogHeader>
          <ErrorMessage message={error} />
          <Textarea aria-label="Reason" rows={3} className="rounded-xl" placeholder="The photo is blurry. Upload a clearer scan." value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-full" onClick={() => setRejecting(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" className="h-11 rounded-full px-5" onClick={() => review("REJECT")} disabled={pending}>
              {pending ? <LoadingSpinner /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

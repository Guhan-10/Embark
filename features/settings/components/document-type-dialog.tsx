"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { DEFAULT_ALLOWED_MIME_TYPES, FILE_TYPE_NAMES } from "@/lib/constants/files";
import { createDocumentTypeAction, updateDocumentTypeAction } from "../actions";

export type DocumentTypeValues = {
  name: string;
  description: string;
  isRequired: boolean;
  hasExpiry: boolean;
  allowedMimeTypes: string[];
  maxSizeMb: number;
};

const EMPTY: DocumentTypeValues = { name: "", description: "", isRequired: false, hasExpiry: false, allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES, maxSizeMb: 10 };

/** Add or edit a document type. Changes apply to new uploads; existing documents aren't re-checked. */
export function DocumentTypeDialog({ trigger, documentType }: { trigger: React.ReactNode; documentType?: { id: string } & DocumentTypeValues }) {
  const initial = documentType ?? EMPTY;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<DocumentTypeValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<DocumentTypeValues>) => setValues((v) => ({ ...v, ...patch }));

  const save = () =>
    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      const result = documentType ? await updateDocumentTypeAction(documentType.id, values) : await createDocumentTypeAction(values);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        return setError(result.error);
      }
      toast.success(documentType ? "Document type saved" : `${values.name} added`);
      setOpen(false);
    });

  const errorsFor = (name: string) => fieldErrors[name]?.map((message) => ({ message }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) {
          setValues(initial);
          setError(null);
          setFieldErrors({});
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{documentType ? `Edit ${documentType.name}` : "Add a document type"}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <ErrorMessage message={error} />
          <Field data-invalid={Boolean(fieldErrors.name)}>
            <FieldLabel htmlFor="doctype-name">Name</FieldLabel>
            <Input id="doctype-name" className="h-11 rounded-xl" placeholder="PAN card" value={values.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={Boolean(fieldErrors.name)} autoFocus />
            <FieldError errors={errorsFor("name")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="doctype-description">What to upload (optional)</FieldLabel>
            <Textarea
              id="doctype-description"
              rows={2}
              className="rounded-xl"
              placeholder="Both sides, clearly readable."
              value={values.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>

          <fieldset className="flex flex-col gap-2" aria-invalid={Boolean(fieldErrors.allowedMimeTypes)}>
            <legend className="mb-2 text-sm font-medium">File types allowed</legend>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_ALLOWED_MIME_TYPES.map((mime) => (
                <label key={mime} className="flex h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm ring-1 ring-border has-data-checked:bg-accent/60 has-data-checked:ring-primary/40">
                  <Checkbox
                    checked={values.allowedMimeTypes.includes(mime)}
                    onCheckedChange={(on) =>
                      set({ allowedMimeTypes: on === true ? [...values.allowedMimeTypes, mime] : values.allowedMimeTypes.filter((m) => m !== mime) })
                    }
                  />
                  {FILE_TYPE_NAMES[mime] ?? mime}
                </label>
              ))}
            </div>
            <FieldError errors={errorsFor("allowedMimeTypes")} />
          </fieldset>

          <Field data-invalid={Boolean(fieldErrors.maxSizeMb)}>
            <FieldLabel htmlFor="doctype-size">Largest file (MB)</FieldLabel>
            <Input
              id="doctype-size"
              type="number"
              min={1}
              max={10}
              className="h-11 w-32! rounded-xl"
              value={Number.isNaN(values.maxSizeMb) ? "" : values.maxSizeMb}
              onChange={(e) => set({ maxSizeMb: e.target.valueAsNumber })}
              aria-invalid={Boolean(fieldErrors.maxSizeMb)}
            />
            <FieldDescription>Between 1 and 10 MB.</FieldDescription>
            <FieldError errors={errorsFor("maxSizeMb")} />
          </Field>

          <div className="flex flex-col divide-y rounded-2xl ring-1 ring-border">
            {(
              [
                ["isRequired", "Required for everyone", "Shows on every new hire's checklist."],
                ["hasExpiry", "Has an expiry date", "People enter the expiry date, and HR is reminded before it lapses."],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="flex cursor-pointer items-center justify-between gap-4 p-4">
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
                <Switch checked={values[key]} onCheckedChange={(on) => set({ [key]: on })} />
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="h-11 rounded-full px-6" disabled={pending}>
              {pending ? <LoadingSpinner label="Saving" /> : null}
              {documentType ? "Save" : "Add document type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, FileCheck2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ErrorMessage } from "@/components/shared/error-message";
import { DEFAULT_ALLOWED_MIME_TYPES, FILE_TYPE_NAMES, MAX_UPLOAD_BYTES } from "@/lib/constants/files";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/format";
import type { ActionResult } from "@/lib/utils/action";

export type UploadDocumentType = {
  id: string;
  name: string;
  hasExpiry: boolean;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
};

const EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg,.jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

/**
 * Drag-and-drop upload with a progress bar. Checks type and size before sending (the server checks again,
 * by the file's real contents). Pass `taskId` to upload for a task, or `employeeId` with a type picker.
 */
export function DocumentUpload({
  taskId,
  employeeId,
  documentTypes,
  fixedType,
  onUploaded,
}: {
  taskId?: string;
  employeeId?: string;
  /** Types to choose from when the document isn't for a specific task. */
  documentTypes?: UploadDocumentType[];
  /** The task's required type, if any. */
  fixedType?: UploadDocumentType | null;
  onUploaded?: (id: string) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [typeId, setTypeId] = useState(fixedType?.id ?? "");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const type = fixedType ?? documentTypes?.find((t) => t.id === typeId) ?? null;
  const allowed = type?.allowedMimeTypes.length ? type.allowedMimeTypes : DEFAULT_ALLOWED_MIME_TYPES;
  const maxBytes = Math.min(type?.maxSizeBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
  const allowedNames = allowed.map((m) => FILE_TYPE_NAMES[m] ?? m).join(", ");

  const choose = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (f.size > maxBytes) return setError(`That file is ${formatFileSize(f.size)}. The limit is ${formatFileSize(maxBytes)}.`);
    if (f.type && !allowed.includes(f.type)) return setError(`That file type isn't accepted here. Upload ${allowedNames}.`);
    setFile(f);
  };

  const upload = () => {
    if (!file) return setError("Choose a file first.");
    if (!taskId && documentTypes && !typeId) return setError("Choose what kind of document this is.");
    if (type?.hasExpiry && !expiryDate) return setError(`Enter the expiry date for this ${type.name}.`);
    setError(null);

    const body = new FormData();
    body.append("file", file);
    if (taskId) body.append("taskId", taskId);
    if (employeeId) body.append("employeeId", employeeId);
    if (typeId) body.append("documentTypeId", typeId);
    if (expiryDate) body.append("expiryDate", expiryDate);

    // XMLHttpRequest rather than fetch, for upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => {
      setProgress(null);
      setError("The upload didn't go through. Check your connection and try again.");
    };
    xhr.onload = () => {
      setProgress(null);
      let result: ActionResult<{ id: string }>;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        return setError("The upload didn't go through. Try again.");
      }
      if (!result.ok) return setError(result.error);
      toast.success(taskId ? "Uploaded. The task is done and waiting for HR to review the document." : "Uploaded. HR will review it.");
      setFile(null);
      setExpiryDate("");
      onUploaded?.(result.data.id);
      router.refresh();
    };
    setProgress(0);
    xhr.send(body);
  };

  return (
    <div className="flex flex-col gap-4">
      <ErrorMessage message={error} />
      {documentTypes && !fixedType ? (
        <Field>
          <FieldLabel htmlFor="documentType">Document</FieldLabel>
          <Select value={typeId} onValueChange={setTypeId}>
            <SelectTrigger id="documentType" className="w-full rounded-xl">
              <SelectValue placeholder="Choose what you're uploading" />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-label={file ? `Selected ${file.name}. Choose a different file` : "Choose a file to upload, or drop it here"}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
          dragging ? "border-primary bg-accent" : "border-primary/30 bg-accent/40 hover:border-primary/60",
        )}
      >
        {file ? (
          <>
            <FileCheck2 className="size-8 text-primary" aria-hidden="true" />
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4" aria-hidden="true" /> {file.name}
              <span className="font-normal text-muted-foreground">· {formatFileSize(file.size)}</span>
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" /> Remove
            </button>
          </>
        ) : (
          <>
            <CloudUpload className="size-8 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold">Drop a file here, or click to choose</p>
            <p className="text-xs text-muted-foreground">
              {allowedNames} · up to {formatFileSize(maxBytes)}
            </p>
          </>
        )}
      </div>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={allowed.map((m) => EXTENSIONS[m] ?? m).join(",")}
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {type?.hasExpiry ? (
        <Field>
          <FieldLabel htmlFor="expiryDate">Expiry date</FieldLabel>
          <Input id="expiryDate" type="date" className="h-11 rounded-xl" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          <FieldDescription>We&apos;ll remind you before it expires.</FieldDescription>
        </Field>
      ) : null}

      {progress !== null ? (
        <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress" className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <Button size="lg" className="h-11 rounded-full" onClick={upload} disabled={progress !== null || !file}>
        <CloudUpload /> {progress !== null ? `Uploading… ${progress}%` : "Upload"}
      </Button>
    </div>
  );
}

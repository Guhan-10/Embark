"use client";

import { useRouter } from "next/navigation";
import { DocumentUpload, type UploadDocumentType } from "./document-upload";

/** The upload page's uploader: opens the new document once it's uploaded. */
export function UploadPanel({ employeeId, documentTypes }: { employeeId: string; documentTypes: UploadDocumentType[] }) {
  const router = useRouter();
  return <DocumentUpload employeeId={employeeId} documentTypes={documentTypes} onUploaded={(id) => router.push(`/documents/${id}`)} />;
}

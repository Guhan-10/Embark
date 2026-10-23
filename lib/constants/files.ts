export const MIME = {
  PDF: "application/pdf",
  PNG: "image/png",
  JPEG: "image/jpeg",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/** Every file type Embark accepts. Document types can narrow this further. */
export const DEFAULT_ALLOWED_MIME_TYPES: string[] = Object.values(MIME);

/**
 * Hard ceiling for any upload, whatever the document type allows: 10 MB, or less when
 * NEXT_PUBLIC_MAX_UPLOAD_MB is set (Vercel rejects request bodies over 4.5 MB, so use 4 there).
 */
export const MAX_UPLOAD_BYTES = Math.min(Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 10, 10) * 1024 * 1024;

export const FILE_TYPE_NAMES: Record<string, string> = {
  [MIME.PDF]: "PDF",
  [MIME.PNG]: "PNG",
  [MIME.JPEG]: "JPG",
  [MIME.DOCX]: "Word (.docx)",
};

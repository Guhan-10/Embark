import "server-only";
import { fileTypeFromBuffer } from "file-type";
import { DEFAULT_ALLOWED_MIME_TYPES, FILE_TYPE_NAMES, MAX_UPLOAD_BYTES, MIME } from "@/lib/constants/files";
import { ActionError } from "@/lib/utils/action";

export { DEFAULT_ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, MIME } from "@/lib/constants/files";

/** Files that are safe to show inline in the browser; everything else is always downloaded. */
export const INLINE_MIME_TYPES: string[] = [MIME.PDF, MIME.PNG, MIME.JPEG];

function describe(mimeTypes: string[]) {
  return mimeTypes.map((m) => FILE_TYPE_NAMES[m] ?? m).join(", ");
}

/** Strips paths and odd characters, caps the length, and makes the extension match the real file type. */
export function sanitizeFileName(originalName: string, extension: string) {
  const base = originalName
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._()-]+/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || "document"}.${extension}`;
}

/**
 * Checks an upload against size and type rules. The type comes from the file's contents (magic bytes),
 * never from its name or the browser, so a renamed .exe can't pass as a PDF.
 */
export async function validateUpload(
  bytes: Uint8Array,
  originalName: string,
  rules: { allowedMimeTypes?: string[]; maxSizeBytes?: number } = {},
) {
  const allowed = rules.allowedMimeTypes?.length ? rules.allowedMimeTypes : DEFAULT_ALLOWED_MIME_TYPES;
  const maxBytes = Math.min(rules.maxSizeBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);

  if (bytes.byteLength === 0) throw new ActionError("That file is empty.");
  if (bytes.byteLength > maxBytes) {
    throw new ActionError(`That file is too large. The limit is ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  }

  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || !allowed.includes(detected.mime)) {
    throw new ActionError(`That file type isn't allowed here. Upload ${describe(allowed)}.`);
  }

  return {
    mimeType: detected.mime,
    fileName: sanitizeFileName(originalName, detected.ext),
    size: bytes.byteLength,
  };
}

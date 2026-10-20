import { openDocument } from "@/features/documents/service";
import { getCurrentUser } from "@/lib/auth/rbac";
import { INLINE_MIME_TYPES } from "@/lib/storage/file-validation";
import { runAction } from "@/lib/utils/action";

/** Streams a private document after checking access. `?inline=1` previews PDFs and images in the browser. */
export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "You need to sign in." }, { status: 401 });

  const { documentId } = await params;
  const result = await runAction(() => openDocument(user, documentId));
  if (!result.ok) return Response.json(result, { status: 404 });

  const { document, stream } = result.data;
  const inline = new URL(request.url).searchParams.get("inline") === "1" && INLINE_MIME_TYPES.includes(document.mimeType);
  const asciiName = document.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");

  return new Response(stream, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.fileSize),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Only Embark's own pages may show a preview. Nothing in the file may load or run anything else;
      // PDFs need object-src for the browser's built-in viewer (and can't be sandboxed for the same reason).
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy":
        document.mimeType === "application/pdf"
          ? "default-src 'none'; object-src 'self'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'"
          : "sandbox; default-src 'none'; img-src 'self'; frame-ancestors 'self'",
    },
  });
}

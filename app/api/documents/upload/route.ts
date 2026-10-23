import { revalidatePath } from "next/cache";
import { uploadDocument } from "@/features/documents/service";
import { getCurrentUser } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/file-validation";
import { runAction } from "@/lib/utils/action";

/**
 * Multipart upload: `file` plus `taskId` or `employeeId`, and optionally `documentTypeId` and `expiryDate`.
 * Responds with the same { ok, data | error } shape as server actions.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(env.APP_URL).origin) {
    return Response.json({ ok: false, error: "Cross-site uploads aren't allowed." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "You need to sign in." }, { status: 401 });

  // Refuse obviously oversized bodies before reading them (form overhead allowed for).
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) {
    const limitMb = Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024);
    return Response.json({ ok: false, error: `That file is too large. The limit is ${limitMb} MB.` }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "Send the file as multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "Choose a file to upload." }, { status: 400 });
  }
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : undefined;
  };

  const result = await runAction(async () => {
    const document = await uploadDocument(
      user,
      { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
      {
        taskId: field("taskId"),
        employeeId: field("employeeId"),
        documentTypeId: field("documentTypeId"),
        expiryDate: field("expiryDate"),
      },
    );
    revalidatePath("/documents");
    revalidatePath(`/employees/${document.employeeId}`);
    if (document.taskId) revalidatePath(`/tasks/${document.taskId}`);
    return { id: document.id, status: document.status };
  });

  return Response.json(result, { status: result.ok ? 201 : 400 });
}

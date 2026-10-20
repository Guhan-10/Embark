import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { effectiveHrUserId, hrOwnerSelect } from "@/lib/auth/hr-owner";
import { assertCan, can, employeeScope, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CLOSED_TASK_STATUSES } from "@/lib/constants/task-status";
import { audit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { validateUpload } from "@/lib/storage/file-validation";
import { deleteObject, getObjectStream, putObject } from "@/lib/storage/s3";
import { ActionError } from "@/lib/utils/action";
import { startOfToday } from "@/lib/utils/date";
import { notify, type NewNotification } from "@/features/notifications/service";
import { recalculateProcess } from "@/features/onboarding/service";
import { managedTaskScope, taskScope } from "@/features/tasks/scope";
import { reviewSchema, uploadMetaSchema } from "./schemas";
import type { ReviewInput, UploadFile, UploadMeta } from "./types";

type Tx = Prisma.TransactionClient;

const employeeForDocs = {
  ...hrOwnerSelect,
  id: true,
  userId: true,
  firstName: true,
  lastName: true,
  archivedAt: true,
} satisfies Prisma.EmployeeSelect;

/** Works out whose document this is and which task/type it's for, checking the uploader may add it. */
async function resolveUploadTarget(user: CurrentUser, meta: ReturnType<typeof uploadMetaSchema.parse>) {
  if (meta.taskId) {
    const task = await prisma.onboardingTask.findFirst({
      where: { AND: [{ id: meta.taskId }, taskScope(user)] },
      include: {
        assignments: { select: { userId: true } },
        process: { select: { status: true, employee: { select: employeeForDocs } } },
      },
    });
    if (!task) throw new ActionError("Task not found.");
    if (task.process.status === "CANCELLED") throw new ActionError("This onboarding was cancelled.");

    const isAssignee = task.assignments.some((a) => a.userId === user.id);
    const isManaged = await prisma.onboardingTask.count({ where: { AND: [{ id: task.id }, managedTaskScope(user)] } });
    if (!isAssignee && !isManaged) throw new ActionError("Only the people assigned to this task can upload for it.");
    if (meta.documentTypeId && task.documentTypeId && meta.documentTypeId !== task.documentTypeId) {
      throw new ActionError("This task needs a different type of document.");
    }
    return {
      employee: task.process.employee,
      task,
      documentTypeId: task.documentTypeId ?? meta.documentTypeId ?? null,
    };
  }

  const employee = await prisma.employee.findFirst({
    where: { AND: [{ id: meta.employeeId! }, employeeScope(user)] },
    select: employeeForDocs,
  });
  if (!employee) throw new ActionError("Employee not found.");
  return { employee, task: null, documentTypeId: meta.documentTypeId ?? null };
}

/**
 * Stores an uploaded file privately and records it for review. If it's for a task, the task is marked
 * done (it reopens if HR rejects the document). The file goes to storage first; if saving the record
 * fails, the stored file is removed again.
 */
export async function uploadDocument(user: CurrentUser, file: UploadFile, rawMeta: UploadMeta) {
  assertCan(user, PERMISSIONS.DOCUMENT_UPLOAD);
  const meta = uploadMetaSchema.parse(rawMeta);
  const { employee, task, documentTypeId } = await resolveUploadTarget(user, meta);
  if (employee.archivedAt) throw new ActionError("This employee is archived.");

  const type = documentTypeId ? await prisma.documentType.findUnique({ where: { id: documentTypeId } }) : null;
  if (documentTypeId && !type) throw new ActionError("That document type doesn't exist.");

  if (type?.hasExpiry && !meta.expiryDate) throw new ActionError(`Enter the expiry date for this ${type.name}.`);
  if (meta.expiryDate && meta.expiryDate < startOfToday()) {
    throw new ActionError("That document has already expired. Upload a valid one.");
  }

  const checked = await validateUpload(file.bytes, file.name, {
    allowedMimeTypes: type?.allowedMimeTypes,
    maxSizeBytes: type?.maxSizeBytes,
  });
  const storageKey = `employees/${employee.id}/${randomUUID()}-${checked.fileName}`;
  await putObject(storageKey, file.bytes, checked.mimeType);

  try {
    return await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          employeeId: employee.id,
          documentTypeId: type?.id ?? null,
          taskId: task?.id ?? null,
          uploadedById: user.id,
          fileName: checked.fileName,
          storageKey,
          mimeType: checked.mimeType,
          fileSize: checked.size,
          expiryDate: meta.expiryDate ?? null,
        },
      });

      const notifications: NewNotification[] = [];
      if (task && !CLOSED_TASK_STATUSES.includes(task.status)) {
        await tx.onboardingTask.update({ where: { id: task.id }, data: { status: "DONE", completedAt: new Date() } });
        await tx.taskStatusHistory.create({
          data: {
            taskId: task.id,
            fromStatus: task.status,
            toStatus: "DONE",
            changedById: user.id,
            note: `Uploaded ${checked.fileName}`,
          },
        });
        notifications.push(...(await recalculateProcess(tx, task.processId)));
      }

      const hrUserId = effectiveHrUserId(employee);
      if (hrUserId) {
        notifications.push({
          userId: hrUserId,
          type: "DOCUMENT_UPLOADED",
          title: `${employee.firstName} ${employee.lastName}: ${type?.name ?? "document"} to review`,
          link: `/documents/${document.id}`,
        });
      }
      await notify(tx, notifications, { exceptUserId: user.id });

      await audit(tx, {
        actorId: user.id,
        action: "document.upload",
        entityType: "Document",
        entityId: document.id,
        metadata: { employeeId: employee.id, taskId: task?.id ?? null, type: type?.name ?? null, size: checked.size },
      });
      return document;
    });
  } catch (error) {
    await deleteObject(storageKey).catch(() => {});
    throw error;
  }
}

async function findDocumentInScope(
  tx: Pick<Tx, "document" | "employee" | "documentType" | "onboardingTask">,
  user: CurrentUser,
  id: string,
) {
  const document = await tx.document.findFirst({ where: { id, deletedAt: null, employee: employeeScope(user) } });
  if (!document) throw new ActionError("Document not found.");
  // Related records are loaded one at a time: inside a transaction there's a single connection, and
  // Prisma would otherwise fetch them in parallel on it.
  const employee = await tx.employee.findUniqueOrThrow({
    where: { id: document.employeeId },
    select: { userId: true, firstName: true, lastName: true },
  });
  const documentType = document.documentTypeId
    ? await tx.documentType.findUnique({ where: { id: document.documentTypeId }, select: { name: true } })
    : null;
  const task = document.taskId
    ? await tx.onboardingTask.findUnique({ where: { id: document.taskId }, select: { id: true, status: true, processId: true } })
    : null;
  return { ...document, employee, documentType, task };
}

/** Reopens a document task when its proof was rejected or removed and nothing else valid is attached. */
async function reopenTaskIfUnproven(tx: Tx, user: CurrentUser, task: { id: string; status: string; processId: string } | null, note: string) {
  if (!task || task.status !== "DONE") return [];
  const stillValid = await tx.document.count({
    where: { taskId: task.id, deletedAt: null, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (stillValid) return [];

  await tx.onboardingTask.update({ where: { id: task.id }, data: { status: "TODO", completedAt: null } });
  await tx.taskStatusHistory.create({
    data: { taskId: task.id, fromStatus: "DONE", toStatus: "TODO", changedById: user.id, note },
  });
  return recalculateProcess(tx, task.processId);
}

/** Approves or rejects a pending document. Nobody reviews their own upload. Rejecting reopens its task. */
export async function reviewDocument(user: CurrentUser, id: string, raw: ReviewInput) {
  assertCan(user, PERMISSIONS.DOCUMENT_REVIEW);
  const input = reviewSchema.parse(raw);

  return prisma.$transaction(async (tx) => {
    const document = await findDocumentInScope(tx, user, id);
    if (document.status !== "PENDING") throw new ActionError("Only documents waiting for review can be reviewed.");
    if (document.uploadedById === user.id || document.employee.userId === user.id) {
      throw new ActionError("Someone else has to review your own documents.");
    }

    const approved = input.decision === "APPROVE";
    const updated = await tx.document.update({
      where: { id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectionReason: approved ? null : input.reason,
      },
    });

    const notifications: NewNotification[] = approved
      ? []
      : await reopenTaskIfUnproven(tx, user, document.task, `Document rejected: ${input.reason}`);
    const label = document.documentType?.name ?? document.fileName;
    for (const userId of [document.employee.userId, document.uploadedById]) {
      if (!userId) continue;
      notifications.push({
        userId,
        type: approved ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED",
        title: approved ? `${label} approved` : `${label} needs another upload`,
        body: approved ? undefined : (input.reason ?? undefined),
        link: document.task ? `/tasks/${document.task.id}` : `/documents/${id}`,
      });
    }
    await notify(tx, notifications, { exceptUserId: user.id });

    await audit(tx, {
      actorId: user.id,
      action: approved ? "document.approve" : "document.reject",
      entityType: "Document",
      entityId: id,
      metadata: approved ? undefined : { reason: input.reason },
    });
    return updated;
  });
}

/**
 * Removes a document from Embark (the file is kept in storage for the audit trail).
 * HR Admins can remove any document they can see; uploaders can remove their own while it's still pending.
 */
export async function deleteDocument(user: CurrentUser, id: string) {
  return prisma.$transaction(async (tx) => {
    const document = await findDocumentInScope(tx, user, id);
    const ownPending = document.uploadedById === user.id && document.status === "PENDING";
    if (!can(user, PERMISSIONS.DOCUMENT_DELETE) && !ownPending) {
      throw new ActionError("You can only remove your own uploads while they're waiting for review.");
    }

    const updated = await tx.document.update({ where: { id }, data: { deletedAt: new Date() } });
    const notifications = await reopenTaskIfUnproven(tx, user, document.task, `Removed ${document.fileName}`);
    await notify(tx, notifications, { exceptUserId: user.id });
    await audit(tx, { actorId: user.id, action: "document.delete", entityType: "Document", entityId: id });
    return updated;
  });
}

/** Checks access and returns the file stream for a download. Every download is audited. */
export async function openDocument(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.DOCUMENT_READ);
  const document = await findDocumentInScope(prisma, user, id);
  const stream = await getObjectStream(document.storageKey);
  await audit(prisma, { actorId: user.id, action: "document.download", entityType: "Document", entityId: id });
  return { document, stream };
}

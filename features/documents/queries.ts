import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { assertCan, can, employeeScope, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { prisma } from "@/lib/db/prisma";
import { INLINE_MIME_TYPES } from "@/lib/storage/file-validation";
import { addDays, daysBetween, startOfToday } from "@/lib/utils/date";
import { documentListSchema } from "./schemas";
import type { DocumentListFilters } from "./types";

const listSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  status: true,
  expiryDate: true,
  createdAt: true,
  documentType: { select: { id: true, name: true } },
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
  uploadedBy: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
} satisfies Prisma.DocumentSelect;

function expiry(expiryDate: Date | null) {
  if (!expiryDate) return null;
  const daysLeft = daysBetween(new Date(), expiryDate);
  return { daysLeft, isExpired: daysLeft < 0, isExpiringSoon: daysLeft >= 0 && daysLeft <= 30 };
}

export async function listDocuments(user: CurrentUser, rawFilters: DocumentListFilters = {}) {
  assertCan(user, PERMISSIONS.DOCUMENT_READ);
  const f = documentListSchema.parse(rawFilters);
  const today = startOfToday();

  const where: Prisma.DocumentWhereInput = {
    AND: [
      { deletedAt: null, employee: employeeScope(user) },
      f.status ? { status: f.status } : {},
      f.employeeId ? { employeeId: f.employeeId } : {},
      f.documentTypeId ? { documentTypeId: f.documentTypeId } : {},
      f.expiringWithinDays ? { expiryDate: { gte: today, lte: addDays(today, f.expiringWithinDays) } } : {},
      f.q ? { fileName: { contains: f.q, mode: "insensitive" } } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: f.expiringWithinDays ? [{ expiryDate: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "asc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: listSelect,
    }),
    prisma.document.count({ where }),
  ]);

  return {
    items: items.map((d) => ({ ...d, expiry: expiry(d.expiryDate) })),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

export async function getDocument(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.DOCUMENT_READ);
  const document = await prisma.document.findFirst({
    where: { id, deletedAt: null, employee: employeeScope(user) },
    select: {
      ...listSelect,
      uploadedById: true,
      rejectionReason: true,
      reviewedAt: true,
      reviewedBy: { select: { id: true, name: true } },
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, userId: true } },
    },
  });
  if (!document) return null;

  const { uploadedById, ...rest } = document;
  const isOwnDocument = uploadedById === user.id || document.employee.userId === user.id;
  return {
    ...rest,
    expiry: expiry(document.expiryDate),
    canPreview: INLINE_MIME_TYPES.includes(document.mimeType),
    downloadUrl: `/api/documents/${document.id}/download`,
    permissions: {
      review: can(user, PERMISSIONS.DOCUMENT_REVIEW) && document.status === "PENDING" && !isOwnDocument,
      delete:
        can(user, PERMISSIONS.DOCUMENT_DELETE) || (uploadedById === user.id && document.status === "PENDING"),
    },
  };
}

/**
 * Required document types for an employee and where each stands: missing, pending, approved, rejected, or expired.
 * Uses the most recent non-deleted upload of each type.
 */
export async function getDocumentChecklist(user: CurrentUser, employeeId: string) {
  assertCan(user, PERMISSIONS.DOCUMENT_READ);
  const employee = await prisma.employee.findFirst({
    where: { AND: [{ id: employeeId }, employeeScope(user)] },
    select: { id: true },
  });
  if (!employee) return null;

  const [types, documents] = await Promise.all([
    prisma.documentType.findMany({ where: { isRequired: true }, orderBy: { name: "asc" } }),
    prisma.document.findMany({
      where: { employeeId, deletedAt: null, documentType: { isRequired: true } },
      orderBy: { createdAt: "desc" },
      select: { id: true, documentTypeId: true, status: true, expiryDate: true, fileName: true },
    }),
  ]);

  const items = types.map((type) => {
    const latest = documents.find((d) => d.documentTypeId === type.id) ?? null;
    return {
      documentType: { id: type.id, name: type.name, hasExpiry: type.hasExpiry },
      status: latest?.status ?? ("MISSING" as const),
      document: latest,
    };
  });
  return { items, complete: items.every((i) => i.status === "APPROVED") };
}

/** Document types for the upload form, with what each accepts. */
export async function listDocumentTypes(user: CurrentUser) {
  assertCan(user, PERMISSIONS.DOCUMENT_UPLOAD);
  return prisma.documentType.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isRequired: true,
      hasExpiry: true,
      allowedMimeTypes: true,
      maxSizeBytes: true,
    },
  });
}

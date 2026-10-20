import type { Prisma } from "@/generated/prisma/client";

type Db = Pick<Prisma.TransactionClient, "auditLog">;

export type AuditEntry = {
  actorId: string | null;
  /** e.g. employee.create, document.approve */
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

/** Records a critical action. Pass the transaction client so the log commits with the change. */
export function audit(db: Db, entry: AuditEntry) {
  return db.auditLog.create({ data: entry });
}

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "emailPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "notifications_emailPending_idx" ON "notifications"("emailPending");


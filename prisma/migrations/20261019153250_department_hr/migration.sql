-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "hrEmployeeId" TEXT;

-- CreateIndex
CREATE INDEX "departments_hrEmployeeId_idx" ON "departments"("hrEmployeeId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_hrEmployeeId_fkey" FOREIGN KEY ("hrEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

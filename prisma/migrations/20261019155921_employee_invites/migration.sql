-- CreateTable
CREATE TABLE "employee_invites" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "employeeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_invites_tokenHash_key" ON "employee_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "employee_invites_employeeId_idx" ON "employee_invites"("employeeId");

-- AddForeignKey
ALTER TABLE "employee_invites" ADD CONSTRAINT "employee_invites_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_invites" ADD CONSTRAINT "employee_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

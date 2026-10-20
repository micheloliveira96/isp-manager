ALTER TABLE "Technician" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Technician_userId_key" ON "Technician"("userId");
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD COLUMN "assignedTechnicianId" TEXT;
CREATE INDEX "ServiceOrder_assignedTechnicianId_scheduledAt_idx" ON "ServiceOrder"("assignedTechnicianId", "scheduledAt");
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

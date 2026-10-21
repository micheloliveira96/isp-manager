CREATE TABLE "FuelRefill" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "technicianId" TEXT,
  "refilledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "odometerKm" INTEGER NOT NULL,
  "liters" DECIMAL(10,2),
  "totalCost" DECIMAL(10,2) NOT NULL,
  "pricePerLiter" DECIMAL(10,3),
  "station" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FuelRefill_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FuelRefill_organizationId_refilledAt_idx" ON "FuelRefill"("organizationId","refilledAt");
CREATE INDEX "FuelRefill_vehicleId_refilledAt_idx" ON "FuelRefill"("vehicleId","refilledAt");
ALTER TABLE "FuelRefill" ADD CONSTRAINT "FuelRefill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelRefill" ADD CONSTRAINT "FuelRefill_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelRefill" ADD CONSTRAINT "FuelRefill_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

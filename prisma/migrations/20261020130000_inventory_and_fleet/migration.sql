-- Inventory and fleet management tables.
CREATE TABLE "InventoryProduct" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'OTHER',
  "sku" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'UN',
  "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
  "minQuantity" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryProduct_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FleetVehicle" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "plate" TEXT NOT NULL,
  "brand" TEXT,
  "model" TEXT NOT NULL,
  "year" INTEGER,
  "driverTechnicianId" TEXT,
  "ipvaDueDate" TIMESTAMP(3),
  "tireStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "lastOilChangeDate" TIMESTAMP(3),
  "lastOilChangeKm" INTEGER,
  "odometerKm" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FleetVehicle_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InventoryAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "technicianId" TEXT,
  "teamId" TEXT,
  "vehicleId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "returnedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryProduct_organizationId_sku_key" ON "InventoryProduct"("organizationId", "sku");
CREATE INDEX "InventoryProduct_organizationId_category_active_idx" ON "InventoryProduct"("organizationId", "category", "active");
CREATE UNIQUE INDEX "FleetVehicle_organizationId_plate_key" ON "FleetVehicle"("organizationId", "plate");
CREATE INDEX "FleetVehicle_organizationId_status_idx" ON "FleetVehicle"("organizationId", "status");
CREATE INDEX "FleetVehicle_driverTechnicianId_idx" ON "FleetVehicle"("driverTechnicianId");
CREATE INDEX "InventoryAssignment_organizationId_status_idx" ON "InventoryAssignment"("organizationId", "status");
CREATE INDEX "InventoryAssignment_productId_status_idx" ON "InventoryAssignment"("productId", "status");
CREATE INDEX "InventoryAssignment_technicianId_status_idx" ON "InventoryAssignment"("technicianId", "status");
CREATE INDEX "InventoryAssignment_teamId_status_idx" ON "InventoryAssignment"("teamId", "status");
CREATE INDEX "InventoryAssignment_vehicleId_status_idx" ON "InventoryAssignment"("vehicleId", "status");
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_driverTechnicianId_fkey" FOREIGN KEY ("driverTechnicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryAssignment" ADD CONSTRAINT "InventoryAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAssignment" ADD CONSTRAINT "InventoryAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAssignment" ADD CONSTRAINT "InventoryAssignment_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryAssignment" ADD CONSTRAINT "InventoryAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ServiceTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryAssignment" ADD CONSTRAINT "InventoryAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

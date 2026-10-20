-- Clients, internet plans, invoices and payment history. Additive migration; existing records are preserved.
CREATE TABLE "InternetPlan" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "downloadMbps" INTEGER NOT NULL, "uploadMbps" INTEGER NOT NULL,
 "monthlyPrice" DECIMAL(10,2) NOT NULL, "description" TEXT,
 "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "InternetPlan_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Client" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "number" TEXT NOT NULL, "name" TEXT NOT NULL,
 "taxNumber" TEXT, "address" TEXT, "postalCode" TEXT, "locality" TEXT, "phone" TEXT NOT NULL,
 "alternatePhone" TEXT, "email" TEXT, "planId" TEXT, "monthlyPrice" DECIMAL(10,2) NOT NULL,
 "installDate" TIMESTAMP(3), "dueDay" INTEGER NOT NULL DEFAULT 10, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
 "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BillingInvoice" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "clientId" TEXT NOT NULL, "period" TEXT NOT NULL,
 "amount" DECIMAL(10,2) NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Payment" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "clientId" TEXT NOT NULL, "invoiceId" TEXT,
 "amount" DECIMAL(10,2) NOT NULL, "method" TEXT NOT NULL, "reference" TEXT,
 "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InternetPlan_organizationId_name_key" ON "InternetPlan"("organizationId","name");
CREATE INDEX "InternetPlan_organizationId_active_idx" ON "InternetPlan"("organizationId","active");
CREATE UNIQUE INDEX "Client_organizationId_number_key" ON "Client"("organizationId","number");
CREATE INDEX "Client_organizationId_name_idx" ON "Client"("organizationId","name");
CREATE INDEX "Client_organizationId_phone_idx" ON "Client"("organizationId","phone");
CREATE INDEX "Client_organizationId_email_idx" ON "Client"("organizationId","email");
CREATE INDEX "Client_organizationId_status_idx" ON "Client"("organizationId","status");
CREATE UNIQUE INDEX "BillingInvoice_clientId_period_key" ON "BillingInvoice"("clientId","period");
CREATE INDEX "BillingInvoice_organizationId_status_dueDate_idx" ON "BillingInvoice"("organizationId","status","dueDate");
CREATE INDEX "BillingInvoice_clientId_dueDate_idx" ON "BillingInvoice"("clientId","dueDate");
CREATE INDEX "Payment_organizationId_paidAt_idx" ON "Payment"("organizationId","paidAt");
CREATE INDEX "Payment_clientId_paidAt_idx" ON "Payment"("clientId","paidAt");
ALTER TABLE "InternetPlan" ADD CONSTRAINT "InternetPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InternetPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

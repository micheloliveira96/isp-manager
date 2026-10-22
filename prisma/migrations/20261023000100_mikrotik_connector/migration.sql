-- CreateTable
CREATE TABLE "MikrotikRouter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agentTokenHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "snapshotAt" TIMESTAMP(3),
    "snapshot" JSONB,
    "routerOnline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MikrotikRouter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MikrotikSubscriber" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "routerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "authStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MikrotikSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MikrotikJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "routerId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "action" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "payloadCipher" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "leaseTokenHash" TEXT,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MikrotikJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MikrotikRouter_agentTokenHash_key" ON "MikrotikRouter"("agentTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "MikrotikRouter_organizationId_id_key" ON "MikrotikRouter"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MikrotikRouter_organizationId_name_key" ON "MikrotikRouter"("organizationId", "name");

-- CreateIndex
CREATE INDEX "MikrotikSubscriber_organizationId_clientId_idx" ON "MikrotikSubscriber"("organizationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MikrotikSubscriber_routerId_username_key" ON "MikrotikSubscriber"("routerId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "MikrotikSubscriber_routerId_clientId_key" ON "MikrotikSubscriber"("routerId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MikrotikSubscriber_organizationId_id_key" ON "MikrotikSubscriber"("organizationId", "id");

-- CreateIndex
CREATE INDEX "MikrotikJob_routerId_status_createdAt_idx" ON "MikrotikJob"("routerId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MikrotikJob_organizationId_requestKey_key" ON "MikrotikJob"("organizationId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Client_organizationId_id_key" ON "Client"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InternetPlan_organizationId_id_key" ON "InternetPlan"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "MikrotikRouter" ADD CONSTRAINT "MikrotikRouter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikrotikSubscriber" ADD CONSTRAINT "MikrotikSubscriber_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikrotikSubscriber" ADD CONSTRAINT "MikrotikSubscriber_organizationId_routerId_fkey" FOREIGN KEY ("organizationId", "routerId") REFERENCES "MikrotikRouter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikrotikSubscriber" ADD CONSTRAINT "MikrotikSubscriber_organizationId_clientId_fkey" FOREIGN KEY ("organizationId", "clientId") REFERENCES "Client"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikrotikSubscriber" ADD CONSTRAINT "MikrotikSubscriber_organizationId_planId_fkey" FOREIGN KEY ("organizationId", "planId") REFERENCES "InternetPlan"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikrotikJob" ADD CONSTRAINT "MikrotikJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikrotikJob" ADD CONSTRAINT "MikrotikJob_organizationId_routerId_fkey" FOREIGN KEY ("organizationId", "routerId") REFERENCES "MikrotikRouter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikrotikJob" ADD CONSTRAINT "MikrotikJob_organizationId_subscriberId_fkey" FOREIGN KEY ("organizationId", "subscriberId") REFERENCES "MikrotikSubscriber"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "installationConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "installationConfirmedBy" TEXT,
ADD COLUMN     "installationState" TEXT NOT NULL DEFAULT 'LEGACY';

-- AlterTable
ALTER TABLE "MikrotikSubscriber" ADD COLUMN     "accessState" TEXT NOT NULL DEFAULT 'WAITING',
ADD COLUMN     "credentialCipher" TEXT,
ADD COLUMN     "graceExpiresAt" TIMESTAMP(3),
ADD COLUMN     "graceStartedAt" TIMESTAMP(3),
ADD COLUMN     "managedLifecycle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncMessage" TEXT,
ADD COLUMN     "syncState" TEXT NOT NULL DEFAULT 'CONFIRMED';

-- AlterTable
ALTER TABLE "MikrotikJob" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifecycleRevision" INTEGER,
ADD COLUMN     "lifecycleTarget" TEXT,
ADD COLUMN     "retryAt" TIMESTAMP(3);

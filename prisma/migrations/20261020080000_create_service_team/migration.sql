CREATE TABLE IF NOT EXISTS "ServiceTeam" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceTeam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceTeam_organizationId_name_key"
ON "ServiceTeam"("organizationId", "name");

CREATE INDEX IF NOT EXISTS "ServiceTeam_organizationId_active_idx"
ON "ServiceTeam"("organizationId", "active");

DO $$
BEGIN
    ALTER TABLE "ServiceTeam"
    ADD CONSTRAINT "ServiceTeam_organizationId_fkey"
    FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('SENT', 'OPENED', 'JOINED', 'REVOKED');

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "networkTenantId" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "inviteVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLogins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "mfaLastStep" INTEGER,
ADD COLUMN     "mfaPendingSecret" TEXT,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT,
    "inviterPersonId" TEXT,
    "personId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "note" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'SENT',
    "openedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "joinedPersonId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invite_tenantId_status_idx" ON "Invite"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Invite_inviterPersonId_idx" ON "Invite"("inviterPersonId");

-- CreateIndex
CREATE INDEX "Partner_networkTenantId_idx" ON "Partner"("networkTenantId");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_networkTenantId_fkey" FOREIGN KEY ("networkTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_inviterPersonId_fkey" FOREIGN KEY ("inviterPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_joinedPersonId_fkey" FOREIGN KEY ("joinedPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: give every existing agency its owning network. Prefer a tenant it already does
-- business with; otherwise, when the database holds exactly one network, that one. Anything
-- still NULL afterwards is invisible to internal users until an owner is assigned.
UPDATE "Partner" p SET "networkTenantId" = x."tenantId"
FROM (
  SELECT DISTINCT ON ("partnerId") "partnerId", "tenantId" FROM (
    SELECT "partnerId", "tenantId", "createdAt" FROM "CommercialAccount" WHERE "partnerId" IS NOT NULL
    UNION ALL SELECT "partnerId", "tenantId", "createdAt" FROM "Opportunity" WHERE "partnerId" IS NOT NULL
    UNION ALL SELECT "recruitmentPartnerId", "tenantId", "createdAt" FROM "Introduction" WHERE "recruitmentPartnerId" IS NOT NULL
  ) u ORDER BY "partnerId", "createdAt" ASC
) x
WHERE p.id = x."partnerId" AND p."networkTenantId" IS NULL;

UPDATE "Partner" SET "networkTenantId" = (SELECT id FROM "Tenant" WHERE type IN ('PLATFORM_OWNER', 'CONSULTANCY') ORDER BY "createdAt" ASC LIMIT 1)
WHERE "networkTenantId" IS NULL
  AND (SELECT count(*) FROM "Tenant" WHERE type IN ('PLATFORM_OWNER', 'CONSULTANCY')) = 1;

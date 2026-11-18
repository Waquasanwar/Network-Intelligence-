-- CreateEnum
CREATE TYPE "ReferenceStatus" AS ENUM ('SENT', 'ANSWERED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PublicRequestKind" AS ENUM ('JOIN', 'NEED');

-- CreateEnum
CREATE TYPE "PublicRequestStatus" AS ENUM ('NEW', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "screeningAutoAccept" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReferenceRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdById" TEXT,
    "refereeName" TEXT NOT NULL,
    "refereeEmail" TEXT,
    "context" TEXT NOT NULL,
    "status" "ReferenceStatus" NOT NULL DEFAULT 'SENT',
    "openedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "vouchId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "PublicRequestKind" NOT NULL,
    "status" "PublicRequestStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organisation" TEXT,
    "headline" TEXT,
    "linkedinUrl" TEXT,
    "knows" TEXT,
    "message" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,
    "inviteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceRequest_vouchId_key" ON "ReferenceRequest"("vouchId");

-- CreateIndex
CREATE INDEX "ReferenceRequest_personId_status_idx" ON "ReferenceRequest"("personId", "status");

-- CreateIndex
CREATE INDEX "ReferenceRequest_tenantId_idx" ON "ReferenceRequest"("tenantId");

-- CreateIndex
CREATE INDEX "PublicRequest_tenantId_kind_status_idx" ON "PublicRequest"("tenantId", "kind", "status");

-- CreateIndex
CREATE INDEX "PublicRequest_email_idx" ON "PublicRequest"("email");

-- AddForeignKey
ALTER TABLE "ReferenceRequest" ADD CONSTRAINT "ReferenceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceRequest" ADD CONSTRAINT "ReferenceRequest_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequest" ADD CONSTRAINT "PublicRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

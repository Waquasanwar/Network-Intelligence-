-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('CLIENT', 'AGENCY', 'EXPERT_NETWORK');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('NEW', 'QUALIFYING', 'SEARCHING', 'SHORTLISTED', 'INTRODUCING', 'FILLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BriefVia" AS ENUM ('OWNER', 'PORTAL');

-- CreateEnum
CREATE TYPE "ShortlistDecision" AS ENUM ('CANDIDATE', 'SHORTLISTED', 'PROPOSED', 'CLIENT_INTERESTED', 'CLIENT_PASSED', 'INTRODUCED', 'PLACED', 'NOT_FOR_THIS');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('FORECAST', 'AGREED', 'INVOICED', 'PAID', 'WRITTEN_OFF');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "workRights" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "rateCard" JSONB;

-- CreateTable
CREATE TABLE "CommercialAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PROSPECT',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "monthlyFee" DECIMAL(12,2),
    "terms" JSONB,
    "partnerId" TEXT,
    "portalTenantId" TEXT,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "submittedVia" "BriefVia" NOT NULL DEFAULT 'OWNER',
    "status" "BriefStatus" NOT NULL DEFAULT 'NEW',
    "rawText" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "engagementRoute" "EngagementRoute",
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seniority" "Seniority",
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mustBeLocal" BOOLEAN NOT NULL DEFAULT false,
    "workRights" TEXT,
    "budgetKind" TEXT,
    "budgetAmount" DECIMAL(14,2),
    "budgetMax" DECIMAL(14,2),
    "budgetCurrency" TEXT,
    "durationMonths" INTEGER,
    "startBy" TEXT,
    "assumptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feeModel" TEXT NOT NULL,
    "feePct" DECIMAL(5,2),
    "feeFlat" DECIMAL(12,2),
    "feeCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "expertHours" INTEGER,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortlistItem" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "fitExplanation" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "uncertainty" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checks" JSONB NOT NULL,
    "tier" TEXT NOT NULL,
    "decision" "ShortlistDecision" NOT NULL DEFAULT 'CANDIDATE',
    "note" TEXT,
    "clientNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "personId" TEXT,
    "model" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "gross" DECIMAL(14,2) NOT NULL,
    "ourTake" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'FORECAST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialAccount_portalTenantId_key" ON "CommercialAccount"("portalTenantId");

-- CreateIndex
CREATE INDEX "CommercialAccount_tenantId_kind_idx" ON "CommercialAccount"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "Brief_tenantId_status_idx" ON "Brief"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Brief_accountId_idx" ON "Brief"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortlistItem_briefId_personId_key" ON "ShortlistItem"("briefId", "personId");

-- CreateIndex
CREATE INDEX "FeeLine_tenantId_status_idx" ON "FeeLine"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "CommercialAccount" ADD CONSTRAINT "CommercialAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAccount" ADD CONSTRAINT "CommercialAccount_portalTenantId_fkey" FOREIGN KEY ("portalTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CommercialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLine" ADD CONSTRAINT "FeeLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLine" ADD CONSTRAINT "FeeLine_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLine" ADD CONSTRAINT "FeeLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CommercialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLine" ADD CONSTRAINT "FeeLine_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

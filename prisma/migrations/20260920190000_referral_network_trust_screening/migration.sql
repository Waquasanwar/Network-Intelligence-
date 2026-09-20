-- CreateEnum
CREATE TYPE "ScreeningStatus" AS ENUM ('NONE', 'REGISTERED', 'INVITED', 'BOOKED', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "VouchKind" AS ENUM ('USER', 'PERSON', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('NEW', 'CONTACTED', 'SCREENING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PitchStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'DECLINED');

-- AlterEnum
ALTER TYPE "ConversationType" ADD VALUE 'SCREENING';

-- AlterTable
ALTER TABLE "Brief" ADD COLUMN     "memberSummary" TEXT,
ADD COLUMN     "openToMembers" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "screening" JSONB;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "memberSince" TIMESTAMP(3),
ADD COLUMN     "referralConsent" TEXT,
ADD COLUMN     "screenedAt" TIMESTAMP(3),
ADD COLUMN     "screeningStatus" "ScreeningStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "personId" TEXT;

-- CreateTable
CREATE TABLE "Vouch" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "voucherKind" "VouchKind" NOT NULL,
    "voucherUserId" TEXT,
    "voucherPersonId" TEXT,
    "voucherName" TEXT,
    "source" TEXT,
    "context" TEXT NOT NULL,
    "statement" TEXT,
    "wouldRecommend" BOOLEAN NOT NULL DEFAULT true,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referrerPersonId" TEXT NOT NULL,
    "referredPersonId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "context" TEXT NOT NULL,
    "note" TEXT,
    "briefId" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pitch" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" "PitchStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vouch_personId_idx" ON "Vouch"("personId");

-- CreateIndex
CREATE INDEX "Referral_tenantId_status_idx" ON "Referral"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Pitch_briefId_personId_key" ON "Pitch"("briefId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_voucherUserId_fkey" FOREIGN KEY ("voucherUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vouch" ADD CONSTRAINT "Vouch_voucherPersonId_fkey" FOREIGN KEY ("voucherPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerPersonId_fkey" FOREIGN KEY ("referrerPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredPersonId_fkey" FOREIGN KEY ("referredPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;


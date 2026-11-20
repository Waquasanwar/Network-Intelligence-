-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "knownHow" TEXT;

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "knownHow" TEXT;

-- AlterTable
ALTER TABLE "Vouch" ADD COLUMN     "knownSince" INTEGER;

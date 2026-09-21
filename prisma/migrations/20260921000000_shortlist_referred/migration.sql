-- AlterTable
ALTER TABLE "ShortlistItem" ADD COLUMN     "referred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referredById" TEXT;


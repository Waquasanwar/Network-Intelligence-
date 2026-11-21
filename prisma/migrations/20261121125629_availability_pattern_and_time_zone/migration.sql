-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "daysPerWeek" INTEGER,
ADD COLUMN     "timeZone" TEXT,
ADD COLUMN     "workPattern" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workSetting" TEXT[] DEFAULT ARRAY[]::TEXT[];

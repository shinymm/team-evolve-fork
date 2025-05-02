-- AlterTable
ALTER TABLE "AiTeamMember" ADD COLUMN     "aiModelApiKey" TEXT,
ADD COLUMN     "aiModelBaseUrl" TEXT,
ADD COLUMN     "aiModelName" VARCHAR(100),
ADD COLUMN     "aiModelTemperature" DOUBLE PRECISION DEFAULT 0.2;

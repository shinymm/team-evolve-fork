/*
  Warnings:

  - You are about to alter the column `introduction` on the `ai_team_members` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.

*/
-- AlterTable
ALTER TABLE "ai_team_members" ADD COLUMN     "category" TEXT,
ADD COLUMN     "greeting" VARCHAR(200),
ALTER COLUMN "introduction" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "role" SET DATA TYPE TEXT;

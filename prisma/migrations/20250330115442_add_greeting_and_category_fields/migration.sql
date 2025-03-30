/*
  Warnings:

  - You are about to drop the `ai_team_members` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "ai_team_members";

-- CreateTable
CREATE TABLE "AiTeamMember" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "introduction" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "responsibilities" TEXT NOT NULL,
    "greeting" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "AiTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiTeamMember_createdBy_idx" ON "AiTeamMember"("createdBy");

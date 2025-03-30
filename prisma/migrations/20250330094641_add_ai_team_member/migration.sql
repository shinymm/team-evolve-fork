-- CreateTable
CREATE TABLE "ai_team_members" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "introduction" TEXT NOT NULL,
    "role" VARCHAR(100) NOT NULL,
    "responsibilities" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" VARCHAR(100),

    CONSTRAINT "ai_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_team_members_name_idx" ON "ai_team_members"("name");

-- CreateIndex
CREATE INDEX "ai_team_members_role_idx" ON "ai_team_members"("role");

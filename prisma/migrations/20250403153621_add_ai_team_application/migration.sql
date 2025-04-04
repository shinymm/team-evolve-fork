-- CreateTable
CREATE TABLE "AiTeamApplication" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "introduction" TEXT NOT NULL,
    "entryUrl" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "AiTeamApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiTeamApplication_createdBy_idx" ON "AiTeamApplication"("createdBy");

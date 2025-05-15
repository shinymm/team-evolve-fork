-- CreateTable
CREATE TABLE "RequirementAction" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "contentBefore" TEXT,
    "contentAfter" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RequirementAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequirementAction_systemId_idx" ON "RequirementAction"("systemId");

-- CreateIndex
CREATE INDEX "RequirementAction_processed_idx" ON "RequirementAction"("processed");

-- CreateIndex
CREATE INDEX "RequirementAction_type_idx" ON "RequirementAction"("type");

-- AddForeignKey
ALTER TABLE "RequirementAction" ADD CONSTRAINT "RequirementAction_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "requirement_summaries" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "summary" TEXT NOT NULL,
    "domain" VARCHAR(100) NOT NULL,
    "relatedModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(100),

    CONSTRAINT "requirement_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirement_summaries_domain_idx" ON "requirement_summaries"("domain");

-- CreateIndex
CREATE INDEX "requirement_summaries_name_idx" ON "requirement_summaries"("name");

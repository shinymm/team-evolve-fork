-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "Glossary" (
    "id" SERIAL NOT NULL,
    "term" VARCHAR(255) NOT NULL,
    "english" VARCHAR(255),
    "explanation" TEXT NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "embedding" vector(1536),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(100),

    CONSTRAINT "Glossary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Glossary_term_idx" ON "Glossary"("term");

-- CreateIndex
CREATE INDEX "Glossary_status_idx" ON "Glossary"("status");

-- CreateIndex
CREATE INDEX "Glossary_domain_idx" ON "Glossary"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Glossary_term_domain_key" ON "Glossary"("term", "domain");

-- CreateVectorIndex
CREATE INDEX glossary_embedding_idx ON "Glossary" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "VectorModelConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseURL" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VectorModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Glossary" (
    "id" SERIAL NOT NULL,
    "term" VARCHAR(255) NOT NULL,
    "aliases" VARCHAR(255),
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

-- CreateTable
CREATE TABLE "AIModelConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseURL" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "type" TEXT NOT NULL DEFAULT 'language',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIModelConfig_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "AiTeamMember" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "introduction" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "responsibilities" TEXT NOT NULL,
    "greeting" TEXT,
    "category" TEXT,
    "mcpConfigJson" TEXT,
    "aiModelName" VARCHAR(100),
    "aiModelBaseUrl" TEXT,
    "aiModelApiKey" TEXT,
    "aiModelTemperature" DOUBLE PRECISION DEFAULT 0.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "AiTeamMember_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "System" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "System_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedImage" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ossKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aliyun-oss',
    "fileSize" INTEGER,
    "fileType" TEXT,
    "uploadTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "UploadedImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "ossKey" TEXT NOT NULL,
    "qwenFileId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductInfo" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "userPersona" JSONB NOT NULL,
    "architecture" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Architecture" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "highLevel" TEXT NOT NULL,
    "microservice" TEXT NOT NULL,
    "deployment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Architecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIInterface" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "swaggerEndpoint" TEXT,
    "swaggerDoc" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APIInterface_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementTemplate" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementTemplate_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Glossary_term_idx" ON "Glossary"("term");

-- CreateIndex
CREATE INDEX "Glossary_status_idx" ON "Glossary"("status");

-- CreateIndex
CREATE INDEX "Glossary_domain_idx" ON "Glossary"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Glossary_term_domain_key" ON "Glossary"("term", "domain");

-- CreateIndex
CREATE INDEX "requirement_summaries_domain_idx" ON "requirement_summaries"("domain");

-- CreateIndex
CREATE INDEX "requirement_summaries_name_idx" ON "requirement_summaries"("name");

-- CreateIndex
CREATE INDEX "AiTeamMember_createdBy_idx" ON "AiTeamMember"("createdBy");

-- CreateIndex
CREATE INDEX "AiTeamApplication_createdBy_idx" ON "AiTeamApplication"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "System_name_key" ON "System"("name");

-- CreateIndex
CREATE INDEX "System_status_idx" ON "System"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedImage_ossKey_key" ON "UploadedImage"("ossKey");

-- CreateIndex
CREATE INDEX "UploadedImage_systemId_idx" ON "UploadedImage"("systemId");

-- CreateIndex
CREATE INDEX "UploadedImage_ossKey_idx" ON "UploadedImage"("ossKey");

-- CreateIndex
CREATE INDEX "requirement_files_systemId_idx" ON "requirement_files"("systemId");

-- CreateIndex
CREATE INDEX "requirement_files_uploadedBy_idx" ON "requirement_files"("uploadedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInfo_systemId_key" ON "ProductInfo"("systemId");

-- CreateIndex
CREATE UNIQUE INDEX "Architecture_systemId_key" ON "Architecture"("systemId");

-- CreateIndex
CREATE INDEX "APIInterface_systemId_idx" ON "APIInterface"("systemId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementTemplate_systemId_key" ON "RequirementTemplate"("systemId");

-- CreateIndex
CREATE INDEX "RequirementAction_systemId_idx" ON "RequirementAction"("systemId");

-- CreateIndex
CREATE INDEX "RequirementAction_processed_idx" ON "RequirementAction"("processed");

-- CreateIndex
CREATE INDEX "RequirementAction_type_idx" ON "RequirementAction"("type");

-- AddForeignKey
ALTER TABLE "UploadedImage" ADD CONSTRAINT "UploadedImage_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_files" ADD CONSTRAINT "requirement_files_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInfo" ADD CONSTRAINT "ProductInfo_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Architecture" ADD CONSTRAINT "Architecture_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIInterface" ADD CONSTRAINT "APIInterface_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementTemplate" ADD CONSTRAINT "RequirementTemplate_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementAction" ADD CONSTRAINT "RequirementAction_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;


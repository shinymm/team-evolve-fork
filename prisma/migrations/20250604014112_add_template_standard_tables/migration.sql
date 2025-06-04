-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_name_idx" ON "Template"("name");

-- CreateIndex
CREATE INDEX "Template_createdBy_idx" ON "Template"("createdBy");

-- CreateIndex
CREATE INDEX "Template_tags_idx" ON "Template"("tags");

-- CreateIndex
CREATE INDEX "Standard_name_idx" ON "Standard"("name");

-- CreateIndex
CREATE INDEX "Standard_createdBy_idx" ON "Standard"("createdBy");

-- CreateIndex
CREATE INDEX "Standard_tags_idx" ON "Standard"("tags");

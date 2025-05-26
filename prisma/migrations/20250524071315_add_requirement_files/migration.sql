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

-- CreateIndex
CREATE INDEX "requirement_files_systemId_idx" ON "requirement_files"("systemId");

-- CreateIndex
CREATE INDEX "requirement_files_uploadedBy_idx" ON "requirement_files"("uploadedBy");

-- AddForeignKey
ALTER TABLE "requirement_files" ADD CONSTRAINT "requirement_files_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

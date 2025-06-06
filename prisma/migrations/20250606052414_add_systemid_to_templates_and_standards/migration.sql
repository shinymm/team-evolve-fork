/*
  Warnings:

  - Added the required column `systemId` to the `Standard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `systemId` to the `Template` table without a default value. This is not possible if the table is not empty.

*/

-- 创建一个默认系统记录（如果不存在）
DO $$
DECLARE
  default_system_id TEXT;
BEGIN
  -- 检查是否有系统记录
  SELECT id INTO default_system_id FROM "System" LIMIT 1;
  
  -- 如果没有任何系统记录，创建一个默认系统
  IF default_system_id IS NULL THEN
    default_system_id := 'default-system-' || gen_random_uuid()::text;
    INSERT INTO "System" (id, name, description, status, "createdAt", "updatedAt", "createdBy") 
    VALUES (default_system_id, 'Default System', 'Auto-created default system for migration', 'active', NOW(), NOW(), 'system');
  END IF;

  -- 为标准表添加systemId列（先允许为空）
  ALTER TABLE "Standard" ADD COLUMN "systemId" TEXT;
  
  -- 更新现有记录以使用默认系统ID
  UPDATE "Standard" SET "systemId" = default_system_id WHERE "systemId" IS NULL;
  
  -- 为模板表添加systemId列（先允许为空）
  ALTER TABLE "Template" ADD COLUMN "systemId" TEXT;
  
  -- 更新现有记录以使用默认系统ID
  UPDATE "Template" SET "systemId" = default_system_id WHERE "systemId" IS NULL;
  
  -- 现在将列设置为NOT NULL
  ALTER TABLE "Standard" ALTER COLUMN "systemId" SET NOT NULL;
  ALTER TABLE "Template" ALTER COLUMN "systemId" SET NOT NULL;
END $$;

-- CreateIndex
CREATE INDEX "Standard_systemId_idx" ON "Standard"("systemId");

-- CreateIndex
CREATE INDEX "Template_systemId_idx" ON "Template"("systemId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Standard" ADD CONSTRAINT "Standard_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

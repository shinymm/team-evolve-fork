-- CreateEnum
CREATE TYPE "PlatformType" AS ENUM ('TEAM_EVOLVE', 'JIRA');

-- CreateTable
CREATE TABLE "UserAccessKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PlatformType" NOT NULL,
    "encryptedAccessKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccessKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccessKey_userId_idx" ON "UserAccessKey"("userId");

-- CreateIndex
CREATE INDEX "UserAccessKey_platform_idx" ON "UserAccessKey"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccessKey_userId_platform_key" ON "UserAccessKey"("userId", "platform");

-- AddForeignKey
ALTER TABLE "UserAccessKey" ADD CONSTRAINT "UserAccessKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `userNeeds` on the `ProductInfo` table. All the data in the column will be lost.
  - Added the required column `userPersona` to the `ProductInfo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductInfo" DROP COLUMN "userNeeds",
ADD COLUMN     "userPersona" JSONB NOT NULL,
ALTER COLUMN "overview" SET DATA TYPE TEXT;

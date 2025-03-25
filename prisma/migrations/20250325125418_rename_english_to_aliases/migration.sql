/*
  Warnings:

  - You are about to drop the column `english` on the `Glossary` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Glossary" DROP COLUMN "english",
ADD COLUMN     "aliases" VARCHAR(255);

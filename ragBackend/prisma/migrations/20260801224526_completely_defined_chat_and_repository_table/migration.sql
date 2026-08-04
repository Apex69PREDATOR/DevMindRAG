/*
  Warnings:

  - A unique constraint covering the columns `[fullName]` on the table `Repository` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Repository" ALTER COLUMN "chunksCount" SET DEFAULT 0,
ALTER COLUMN "lastSyncedAt" DROP NOT NULL,
ALTER COLUMN "lastSyncedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");

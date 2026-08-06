/*
  Warnings:

  - A unique constraint covering the columns `[fullName,userId]` on the table `Repository` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_userId_key" ON "Repository"("fullName", "userId");

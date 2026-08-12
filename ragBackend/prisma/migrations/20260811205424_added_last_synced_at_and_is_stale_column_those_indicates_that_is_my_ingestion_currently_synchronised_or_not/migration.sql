-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "isStale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastCommitAt" TIMESTAMP(3);

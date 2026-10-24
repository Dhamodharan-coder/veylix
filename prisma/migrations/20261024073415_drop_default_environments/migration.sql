/*
  Warnings:

  - You are about to drop the `default_environment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "default_environment" DROP CONSTRAINT "default_environment_userId_fkey";

-- DropTable
DROP TABLE "default_environment";

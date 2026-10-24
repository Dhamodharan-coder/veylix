-- AlterTable
ALTER TABLE "vault_account" ADD COLUMN     "recoveryCreatedAt" TIMESTAMP(3),
ADD COLUMN     "recoveryWrappedPrivateKey" TEXT;

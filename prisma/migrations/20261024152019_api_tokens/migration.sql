-- CreateEnum
CREATE TYPE "ApiTokenAccess" AS ENUM ('READ', 'READ_WRITE');

-- CreateTable
CREATE TABLE "api_token" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT,
    "access" "ApiTokenAccess" NOT NULL DEFAULT 'READ',
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_token_tokenHash_key" ON "api_token"("tokenHash");

-- CreateIndex
CREATE INDEX "api_token_userId_idx" ON "api_token"("userId");

-- AddForeignKey
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

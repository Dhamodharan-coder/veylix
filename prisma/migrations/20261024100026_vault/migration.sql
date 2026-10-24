-- CreateEnum
CREATE TYPE "VaultPermission" AS ENUM ('OWNER', 'MANAGE', 'MODIFY', 'VIEW');

-- CreateEnum
CREATE TYPE "VaultItemType" AS ENUM ('LOGIN', 'SECURE_NOTE');

-- CreateTable
CREATE TABLE "vault_account" (
    "userId" TEXT NOT NULL,
    "kdfSalt" TEXT NOT NULL,
    "kdfIterations" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "autoLockMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_account_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "vault_folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_folder_member" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "VaultPermission" NOT NULL,
    "encryptedFolderKey" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_folder_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_invite" (
    "id" TEXT NOT NULL,
    "folderId" TEXT,
    "itemId" TEXT,
    "email" TEXT NOT NULL,
    "permission" "VaultPermission" NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_item" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "type" "VaultItemType" NOT NULL DEFAULT 'LOGIN',
    "name" TEXT NOT NULL,
    "url" TEXT,
    "tags" TEXT[],
    "encryptedItemKey" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "passwordUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_item_share" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "VaultPermission" NOT NULL,
    "encryptedItemKey" TEXT,
    "sharedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_item_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_favorite" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_favorite_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateTable
CREATE TABLE "vault_audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "folderId" TEXT,
    "itemId" TEXT,
    "targetName" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vault_folder_ownerId_idx" ON "vault_folder"("ownerId");

-- CreateIndex
CREATE INDEX "vault_folder_member_userId_idx" ON "vault_folder_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vault_folder_member_folderId_userId_key" ON "vault_folder_member"("folderId", "userId");

-- CreateIndex
CREATE INDEX "vault_invite_email_idx" ON "vault_invite"("email");

-- CreateIndex
CREATE INDEX "vault_item_folderId_idx" ON "vault_item"("folderId");

-- CreateIndex
CREATE INDEX "vault_item_share_userId_idx" ON "vault_item_share"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vault_item_share_itemId_userId_key" ON "vault_item_share"("itemId", "userId");

-- CreateIndex
CREATE INDEX "vault_audit_log_actorId_createdAt_idx" ON "vault_audit_log"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "vault_audit_log_folderId_createdAt_idx" ON "vault_audit_log"("folderId", "createdAt");

-- CreateIndex
CREATE INDEX "vault_audit_log_itemId_createdAt_idx" ON "vault_audit_log"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "vault_account" ADD CONSTRAINT "vault_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_folder" ADD CONSTRAINT "vault_folder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_folder_member" ADD CONSTRAINT "vault_folder_member_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "vault_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_folder_member" ADD CONSTRAINT "vault_folder_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_invite" ADD CONSTRAINT "vault_invite_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "vault_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_invite" ADD CONSTRAINT "vault_invite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "vault_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_item" ADD CONSTRAINT "vault_item_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "vault_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_item_share" ADD CONSTRAINT "vault_item_share_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "vault_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_item_share" ADD CONSTRAINT "vault_item_share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_favorite" ADD CONSTRAINT "vault_favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_favorite" ADD CONSTRAINT "vault_favorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "vault_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_audit_log" ADD CONSTRAINT "vault_audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_audit_log" ADD CONSTRAINT "vault_audit_log_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "vault_folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_audit_log" ADD CONSTRAINT "vault_audit_log_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "vault_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

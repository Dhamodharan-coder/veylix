-- CreateTable
CREATE TABLE "default_environment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "default_environment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "default_environment_userId_name_key" ON "default_environment"("userId", "name");

-- AddForeignKey
ALTER TABLE "default_environment" ADD CONSTRAINT "default_environment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

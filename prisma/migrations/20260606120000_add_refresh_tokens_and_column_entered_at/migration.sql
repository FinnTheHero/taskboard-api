-- AlterTable
ALTER TABLE "Task" ADD COLUMN "columnEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "Task_columnId_position_id_idx" ON "Task"("columnId", "position", "id");

-- CreateIndex
CREATE INDEX "Task_columnId_deadline_id_idx" ON "Task"("columnId", "deadline", "id");

-- CreateIndex
CREATE INDEX "Task_columnId_createdAt_id_idx" ON "Task"("columnId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Task_columnId_priority_id_idx" ON "Task"("columnId", "priority", "id");

-- CreateIndex
CREATE INDEX "Task_columnId_assigneeId_id_idx" ON "Task"("columnId", "assigneeId", "id");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

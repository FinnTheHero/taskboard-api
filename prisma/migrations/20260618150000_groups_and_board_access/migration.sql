-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('MANAGER', 'MEMBER');

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Group_joinCode_key" ON "Group"("joinCode");

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

CREATE UNIQUE INDEX "GroupMember_userId_key" ON "GroupMember"("userId");

-- CreateTable
CREATE TABLE "BoardMember" (
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BoardMember_pkey" PRIMARY KEY ("boardId","userId")
);

CREATE UNIQUE INDEX "BoardMember_boardId_userId_key" ON "BoardMember"("boardId", "userId");

-- Migrate TeamMember -> BoardMember
INSERT INTO "BoardMember" ("boardId", "userId")
SELECT "boardId", "userId" FROM "TeamMember";

-- Add groupId to Board (nullable during backfill)
ALTER TABLE "Board" ADD COLUMN "groupId" TEXT;

-- Backfill existing boards into a legacy group
INSERT INTO "Group" ("id", "name", "joinCode", "createdAt")
VALUES ('legacy-migration-group', 'Legacy Group', '000000', CURRENT_TIMESTAMP);

UPDATE "Board" SET "groupId" = 'legacy-migration-group' WHERE "groupId" IS NULL;

-- Drop old ownership model
ALTER TABLE "Board" DROP CONSTRAINT "Board_ownerId_fkey";
ALTER TABLE "Board" DROP COLUMN "ownerId";
DROP TABLE "TeamMember";
DROP TYPE "MemberRole";

ALTER TABLE "Board" ALTER COLUMN "groupId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Board" ADD CONSTRAINT "Board_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

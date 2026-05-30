-- AlterTable
ALTER TABLE "Task" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Backfill positions by createdAt within each column
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "columnId" ORDER BY "createdAt") - 1 AS pos
  FROM "Task"
)
UPDATE "Task" AS t
SET "position" = ranked.pos
FROM ranked
WHERE t.id = ranked.id;

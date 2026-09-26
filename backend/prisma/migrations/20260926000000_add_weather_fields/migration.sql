-- Fields the weather scan needs: whether a facility is exposed to the weather,
-- where the school is, and a key that lets a job own a blocker across runs.
--
-- Excludes the "Role" enum rewrite that `prisma migrate diff` bundles in; that is
-- pre-existing drift tracked in issue #10 and its USING cast fails on any row still
-- holding the legacy 'VIEWER' value.

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN "is_outdoor" BOOLEAN NOT NULL DEFAULT false;

-- Backfill reproduces exactly what the system already believed: bulk-ops' rain plan
-- treated FIELD, TRACK and COURT as outdoor. Seeding from that keeps rain-plan
-- behaviour identical across this migration; the column exists so a school can then
-- correct the cases the type never could express (indoor courts, outdoor OTHER).
UPDATE "facilities" SET "is_outdoor" = true WHERE "type" IN ('FIELD', 'TRACK', 'COURT');

-- AlterTable
ALTER TABLE "schools" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "schools" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "schools" ADD COLUMN "weather_gridpoint" TEXT;

-- AlterTable
ALTER TABLE "blockers" ADD COLUMN "source_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "blockers_source_key_key" ON "blockers"("source_key");

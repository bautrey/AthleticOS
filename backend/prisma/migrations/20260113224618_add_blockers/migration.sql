-- CreateEnum
CREATE TYPE "BlockerType" AS ENUM ('EXAM', 'MAINTENANCE', 'EVENT', 'TRAVEL', 'HOLIDAY', 'WEATHER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BlockerScope" AS ENUM ('SCHOOL_WIDE', 'TEAM', 'FACILITY');

-- CreateTable
CREATE TABLE "blockers" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "type" "BlockerType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "BlockerScope" NOT NULL,
    "team_id" TEXT,
    "facility_id" TEXT,
    "start_datetime" TIMESTAMP(3) NOT NULL,
    "end_datetime" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "blockers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blockers_school_id_idx" ON "blockers"("school_id");

-- CreateIndex
CREATE INDEX "blockers_start_datetime_end_datetime_idx" ON "blockers"("start_datetime", "end_datetime");

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

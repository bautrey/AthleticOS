-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('GAME', 'PRACTICE');

-- CreateTable
CREATE TABLE "conflict_overrides" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "event_id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "overridden_by" TEXT NOT NULL,
    "overridden_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "conflict_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conflict_overrides_school_id_idx" ON "conflict_overrides"("school_id");

-- CreateIndex
CREATE INDEX "conflict_overrides_event_id_idx" ON "conflict_overrides"("event_id");

-- AddForeignKey
ALTER TABLE "conflict_overrides" ADD CONSTRAINT "conflict_overrides_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

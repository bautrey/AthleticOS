-- CreateTable
CREATE TABLE "schedule_shares" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT,
    "show_notes" BOOLEAN NOT NULL DEFAULT false,
    "show_facility" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "schedule_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_shares_token_key" ON "schedule_shares"("token");

-- CreateIndex
CREATE INDEX "schedule_shares_token_idx" ON "schedule_shares"("token");

-- CreateIndex
CREATE INDEX "schedule_shares_season_id_idx" ON "schedule_shares"("season_id");

-- AddForeignKey
ALTER TABLE "schedule_shares" ADD CONSTRAINT "schedule_shares_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

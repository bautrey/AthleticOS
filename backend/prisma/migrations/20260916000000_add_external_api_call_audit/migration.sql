-- Append-only audit of outbound calls to external systems.
--
-- Excludes the "Role" enum rewrite that `prisma migrate diff` bundles in; that is
-- pre-existing drift tracked in issue #10 and its USING cast fails on any row still
-- holding the legacy 'VIEWER' value.

-- CreateTable
CREATE TABLE "external_api_calls" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "system" "ExternalSystem" NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER,
    "error_kind" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "acting_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_api_calls_school_id_created_at_idx" ON "external_api_calls"("school_id", "created_at");

-- CreateIndex
CREATE INDEX "external_api_calls_school_id_system_created_at_idx" ON "external_api_calls"("school_id", "system", "created_at");

-- AddForeignKey
ALTER TABLE "external_api_calls" ADD CONSTRAINT "external_api_calls_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

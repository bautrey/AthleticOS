-- Files that arrive for a school, and what we made of them.
--
-- Nothing is applied to a schedule on arrival: a scheduled SchoolDude report
-- lands here, gets parsed so a person can see what it holds, and changes the
-- calendar only once somebody approves it.
--
-- Excludes the "Role" enum rewrite that `prisma migrate diff` bundles in; that is
-- pre-existing drift tracked in issue #10.

-- CreateEnum
CREATE TYPE "InboundSource" AS ENUM ('EMAIL', 'UPLOAD');

-- CreateEnum
CREATE TYPE "InboundImportStatus" AS ENUM ('RECEIVED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "schools" ADD COLUMN "inbound_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "schools_inbound_token_key" ON "schools"("inbound_token");

-- CreateTable
CREATE TABLE "inbound_imports" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "source" "InboundSource" NOT NULL DEFAULT 'EMAIL',
    "from_address" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "subject" TEXT,
    "provider_message_id" TEXT,
    "filename" TEXT,
    "content_type" TEXT,
    "size_bytes" INTEGER,
    "content" BYTEA,
    "status" "InboundImportStatus" NOT NULL DEFAULT 'RECEIVED',
    "parse_summary" JSONB,
    "failure_reason" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_imports_pkey" PRIMARY KEY ("id")
);

-- A provider retry must not become a second import.
-- CreateIndex
CREATE UNIQUE INDEX "inbound_imports_provider_message_id_key" ON "inbound_imports"("provider_message_id");

-- CreateIndex
CREATE INDEX "inbound_imports_school_id_status_created_at_idx" ON "inbound_imports"("school_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "inbound_imports" ADD CONSTRAINT "inbound_imports_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

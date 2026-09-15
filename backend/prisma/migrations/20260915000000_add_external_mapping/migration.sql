-- External system identity mapping.
--
-- Deliberately scoped to the ExternalMapping model. `prisma migrate diff` also
-- proposes rewriting the "Role" enum to drop the legacy 'VIEWER' value, which
-- schema.prisma no longer lists but the database still carries from
-- 20260228000000_add_invites_expand_roles. That rewrite is unrelated to this
-- change and its USING cast fails on any row still holding 'VIEWER', so it is
-- excluded here and tracked separately.

-- CreateEnum
CREATE TYPE "ExternalSystem" AS ENUM ('BLACKBAUD');

-- CreateEnum
CREATE TYPE "ExternalEntityType" AS ENUM ('TEAM', 'SEASON', 'FACILITY', 'OPPONENT');

-- CreateEnum
CREATE TYPE "MatchMethod" AS ENUM ('EXACT', 'FUZZY', 'MANUAL', 'IMPORTED');

-- CreateTable
CREATE TABLE "external_mappings" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "system" "ExternalSystem" NOT NULL,
    "entity_type" "ExternalEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_label" TEXT,
    "match_method" "MatchMethod" NOT NULL DEFAULT 'MANUAL',
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_mappings_school_id_system_entity_type_idx" ON "external_mappings"("school_id", "system", "entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "external_mappings_school_id_system_entity_type_entity_id_key" ON "external_mappings"("school_id", "system", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_mappings_school_id_system_entity_type_external_id_key" ON "external_mappings"("school_id", "system", "entity_type", "external_id");

-- AddForeignKey
ALTER TABLE "external_mappings" ADD CONSTRAINT "external_mappings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

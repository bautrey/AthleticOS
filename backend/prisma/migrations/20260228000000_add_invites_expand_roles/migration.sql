-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ATHLETIC_DIRECTOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PARENT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ATHLETE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;

-- AlterTable
ALTER TABLE "school_users" ALTER COLUMN "role" SET DEFAULT 'ATHLETE';

-- CreateTable
CREATE TABLE IF NOT EXISTS "invites" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ATHLETE',
    "token" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invites_token_key" ON "invites"("token");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing VIEWER roles to ATHLETE
UPDATE "school_users" SET "role" = 'ATHLETE' WHERE "role" = 'VIEWER';

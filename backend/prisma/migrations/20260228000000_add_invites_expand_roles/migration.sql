-- Add new role values to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ATHLETIC_DIRECTOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PARENT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ATHLETE';

-- Add name column to users
ALTER TABLE "users" ADD COLUMN "name" TEXT;

-- Create invites table
CREATE TABLE "invites" (
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

-- Create unique index on token
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- Add foreign keys
ALTER TABLE "invites" ADD CONSTRAINT "invites_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update default role for school_users from VIEWER to ATHLETE
ALTER TABLE "school_users" ALTER COLUMN "role" SET DEFAULT 'ATHLETE';

-- Migrate existing VIEWER roles to ATHLETE
UPDATE "school_users" SET "role" = 'ATHLETE' WHERE "role" = 'VIEWER';

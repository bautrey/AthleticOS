-- The weather scan calls api.weather.gov, and those calls belong in the same
-- outbound-call trail as every other external system.
--
-- Separate from 20260926000000 because Postgres will not let a new enum value be
-- used in the same transaction that adds it, and keeping the ALTER TYPE alone
-- means nothing here can trip that rule later.
--
-- Excludes the "Role" enum rewrite that `prisma migrate diff` bundles in; that is
-- pre-existing drift tracked in issue #10.

-- AlterEnum
ALTER TYPE "ExternalSystem" ADD VALUE 'NWS';

-- AlterEnum: Add COMMUNITY to Role enum
-- PostgreSQL cannot use newly added enum values in the same transaction
ALTER TYPE "Role" ADD VALUE 'COMMUNITY';

-- CreateEnum: CalendarFeedType
CREATE TYPE "CalendarFeedType" AS ENUM ('TEAM', 'USER');

-- CreateEnum: NotificationChannel
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP', 'PUSH');

-- CreateEnum: NotificationStatus
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'DELIVERED');

-- CreateEnum: NotificationTrigger
CREATE TYPE "NotificationTrigger" AS ENUM ('CONFLICT_DETECTED', 'CONFLICT_RESOLVED', 'SCHEDULE_CHANGE', 'GAME_REMINDER', 'PRACTICE_REMINDER', 'FACILITY_REQUEST', 'CHECKLIST_ASSIGNED', 'WEATHER_ALERT');

-- CreateEnum: RequestType
CREATE TYPE "RequestType" AS ENUM ('BOOKING', 'MAINTENANCE', 'SETUP', 'TEARDOWN');

-- CreateEnum: RequestStatus
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');

-- CreateEnum: ChecklistItemStatus
CREATE TYPE "ChecklistItemStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

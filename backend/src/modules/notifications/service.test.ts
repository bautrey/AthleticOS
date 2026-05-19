// backend/src/modules/notifications/service.test.ts
// Uses real database per NO MOCKS policy.
// Resend is not configured in the test env (RESEND_API_KEY empty),
// so sendEmail / sendSms take the no-op branch that marks notifications SENT
// without making a network call — perfect for asserting dispatch + status writes.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { prisma } from '../../common/db.js';
import { notificationService } from './service.js';
import { AppError } from '../../common/errors.js';

const EMAIL_NS = `notif-${Date.now()}`;
const PHONE = '+15555550100';

let schoolId: string;
let otherSchoolId: string;
let adminUserId: string;
let coachUserId: string;
let noPhoneUserId: string;

describe('notificationService', () => {
  beforeAll(async () => {
    await prisma.$connect();

    const school = await prisma.school.create({
      data: { name: 'Notif Test School', timezone: 'America/New_York' },
    });
    schoolId = school.id;

    const other = await prisma.school.create({
      data: { name: 'Notif Other School', timezone: 'America/New_York' },
    });
    otherSchoolId = other.id;

    const admin = await prisma.user.create({
      data: { email: `${EMAIL_NS}-admin@test.com`, passwordHash: 'x', phone: PHONE },
    });
    adminUserId = admin.id;
    await prisma.schoolUser.create({
      data: { userId: admin.id, schoolId, role: 'ADMIN' },
    });

    const coach = await prisma.user.create({
      data: { email: `${EMAIL_NS}-coach@test.com`, passwordHash: 'x', phone: PHONE },
    });
    coachUserId = coach.id;
    await prisma.schoolUser.create({
      data: { userId: coach.id, schoolId, role: 'COACH' },
    });

    const noPhone = await prisma.user.create({
      data: { email: `${EMAIL_NS}-nophone@test.com`, passwordHash: 'x' },
    });
    noPhoneUserId = noPhone.id;
    await prisma.schoolUser.create({
      data: { userId: noPhone.id, schoolId, role: 'PARENT' },
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.schoolUser.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.school.deleteMany({
      where: { id: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: EMAIL_NS } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { schoolId: { in: [schoolId, otherSchoolId] } },
    });
  });

  // ─── emit ────────────────────────────────────────────────────────────────────
  describe('emit', () => {
    it('fans out an email to every school member by default', async () => {
      await notificationService.emit({
        trigger: 'SCHEDULE_CHANGE',
        schoolId,
        eventType: 'GAME',
        eventId: 'event-123',
      });

      const emails = await prisma.notification.findMany({
        where: { schoolId, channel: 'EMAIL' },
      });
      // 3 users at the school, all with email and EMAIL on by default.
      expect(emails).toHaveLength(3);
      emails.forEach((n) => {
        expect(n.subject).toBe('Schedule Update');
        expect(n.status).toBe('SENT'); // resend not configured → marked SENT
        expect(n.body).toContain('schedule has been updated');
      });
    });

    it('does NOT fan out SMS by default (SMS opt-in)', async () => {
      await notificationService.emit({
        trigger: 'SCHEDULE_CHANGE',
        schoolId,
        eventType: 'GAME',
      });
      const sms = await prisma.notification.findMany({
        where: { schoolId, channel: 'SMS' },
      });
      expect(sms).toHaveLength(0);
    });

    it('sends SMS to users who opted in AND have a phone on file', async () => {
      // Coach opts in, admin opts in but has phone, no-phone user opts in but has no phone.
      for (const userId of [adminUserId, coachUserId, noPhoneUserId]) {
        await prisma.notificationPreference.create({
          data: {
            userId,
            schoolId,
            channel: 'SMS',
            trigger: 'SCHEDULE_CHANGE',
            enabled: true,
          },
        });
      }

      await notificationService.emit({
        trigger: 'SCHEDULE_CHANGE',
        schoolId,
        eventType: 'PRACTICE',
      });

      const sms = await prisma.notification.findMany({
        where: { schoolId, channel: 'SMS' },
      });
      expect(sms).toHaveLength(2); // admin + coach (noPhone has no phone)
      const recipients = new Set(sms.map((n) => n.userId));
      expect(recipients.has(noPhoneUserId)).toBe(false);
    });

    it('respects emailEnabled=false to suppress email for that user', async () => {
      await prisma.notificationPreference.create({
        data: {
          userId: coachUserId,
          schoolId,
          channel: 'EMAIL',
          trigger: 'SCHEDULE_CHANGE',
          enabled: false,
        },
      });

      await notificationService.emit({
        trigger: 'SCHEDULE_CHANGE',
        schoolId,
        eventType: 'GAME',
      });

      const emails = await prisma.notification.findMany({
        where: { schoolId, channel: 'EMAIL' },
      });
      expect(emails.find((e) => e.userId === coachUserId)).toBeUndefined();
      expect(emails).toHaveLength(2);
    });

    it('writes the trigger-specific subject line into the notification', async () => {
      await notificationService.emit({
        trigger: 'CONFLICT_DETECTED',
        schoolId,
      });
      const n = await prisma.notification.findFirst({ where: { schoolId } });
      expect(n?.subject).toBe('Schedule Conflict Detected');
    });
  });

  // ─── quiet hours + digest queueing ──────────────────────────────────────────
  describe('quiet hours and digest', () => {
    it('queues an email when the user is in quiet hours', async () => {
      // Build a 24-hour quiet window so we always hit it regardless of wall clock.
      await prisma.notificationPreference.create({
        data: {
          userId: adminUserId,
          schoolId,
          channel: 'EMAIL',
          trigger: 'SCHEDULE_CHANGE',
          enabled: true,
          quietStart: '00:00',
          quietEnd: '23:59',
        },
      });

      await notificationService.emit({
        trigger: 'SCHEDULE_CHANGE',
        schoolId,
        eventType: 'GAME',
      });

      const queued = await prisma.notification.findMany({
        where: { userId: adminUserId, schoolId, channel: 'EMAIL', status: 'QUEUED' },
      });
      expect(queued).toHaveLength(1);
      const sent = await prisma.notification.findMany({
        where: { userId: adminUserId, schoolId, channel: 'EMAIL', status: 'SENT' },
      });
      expect(sent).toHaveLength(0);
    });

    it('WEATHER_ALERT bypasses quiet hours (urgent)', async () => {
      await prisma.notificationPreference.create({
        data: {
          userId: adminUserId,
          schoolId,
          channel: 'EMAIL',
          trigger: 'WEATHER_ALERT',
          enabled: true,
          quietStart: '00:00',
          quietEnd: '23:59',
        },
      });

      await notificationService.emit({ trigger: 'WEATHER_ALERT', schoolId });

      const sent = await prisma.notification.findMany({
        where: { userId: adminUserId, schoolId, channel: 'EMAIL', status: 'SENT' },
      });
      expect(sent).toHaveLength(1);
    });

    it('queues when digestEnabled, even outside quiet hours', async () => {
      await prisma.notificationPreference.create({
        data: {
          userId: adminUserId,
          schoolId,
          channel: 'EMAIL',
          trigger: 'SCHEDULE_CHANGE',
          enabled: true,
          digestEnabled: true,
        },
      });

      await notificationService.emit({ trigger: 'SCHEDULE_CHANGE', schoolId });

      const queued = await prisma.notification.findMany({
        where: { userId: adminUserId, schoolId, status: 'QUEUED' },
      });
      expect(queued).toHaveLength(1);
    });
  });

  // ─── preferences ────────────────────────────────────────────────────────────
  describe('getPreferences', () => {
    it('returns defaults when no preferences are stored', async () => {
      const prefs = await notificationService.getPreferences(adminUserId, schoolId);
      expect(prefs.emailEnabled).toBe(true);
      expect(prefs.smsEnabled).toBe(false);
      expect(prefs.preferences).toHaveLength(0);
      expect(prefs.phone).toBe(PHONE);
    });

    it('reflects stored email + SMS settings', async () => {
      await prisma.notificationPreference.create({
        data: {
          userId: adminUserId,
          schoolId,
          channel: 'EMAIL',
          trigger: 'SCHEDULE_CHANGE',
          enabled: false,
          quietStart: '22:00',
          quietEnd: '07:00',
          digestEnabled: true,
        },
      });
      await prisma.notificationPreference.create({
        data: {
          userId: adminUserId,
          schoolId,
          channel: 'SMS',
          trigger: 'SCHEDULE_CHANGE',
          enabled: true,
        },
      });

      const prefs = await notificationService.getPreferences(adminUserId, schoolId);
      expect(prefs.emailEnabled).toBe(false);
      expect(prefs.smsEnabled).toBe(true);
      expect(prefs.quietHoursStart).toBe('22:00');
      expect(prefs.quietHoursEnd).toBe('07:00');
      expect(prefs.digestMode).toBe(true);
    });
  });

  describe('updatePreferences', () => {
    it('updates phone on the user record', async () => {
      const newPhone = '+15555550199';
      await notificationService.updatePreferences(adminUserId, schoolId, { phone: newPhone });
      const user = await prisma.user.findUnique({ where: { id: adminUserId } });
      expect(user?.phone).toBe(newPhone);
      // Restore for downstream tests.
      await prisma.user.update({ where: { id: adminUserId }, data: { phone: PHONE } });
    });

    it('upserts EMAIL preferences for ALL trigger types', async () => {
      await notificationService.updatePreferences(adminUserId, schoolId, {
        emailEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      });
      const stored = await prisma.notificationPreference.findMany({
        where: { userId: adminUserId, schoolId, channel: 'EMAIL' },
      });
      // 8 trigger types in code: CONFLICT_DETECTED, CONFLICT_RESOLVED, SCHEDULE_CHANGE,
      // GAME_REMINDER, PRACTICE_REMINDER, FACILITY_REQUEST, CHECKLIST_ASSIGNED, WEATHER_ALERT
      expect(stored).toHaveLength(8);
      stored.forEach((p) => {
        expect(p.enabled).toBe(false);
        expect(p.quietStart).toBe('22:00');
        expect(p.quietEnd).toBe('07:00');
      });
    });

    it('upserts SMS preferences for ALL trigger types', async () => {
      await notificationService.updatePreferences(adminUserId, schoolId, { smsEnabled: true });
      const stored = await prisma.notificationPreference.findMany({
        where: { userId: adminUserId, schoolId, channel: 'SMS' },
      });
      expect(stored).toHaveLength(8);
      stored.forEach((p) => expect(p.enabled).toBe(true));
    });

    it('updates existing preferences without resetting unrelated fields', async () => {
      // Seed: enabled=true, quiet 22-07
      await notificationService.updatePreferences(adminUserId, schoolId, {
        emailEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      });
      // Change only emailEnabled → quiet hours should remain.
      await notificationService.updatePreferences(adminUserId, schoolId, {
        emailEnabled: false,
      });
      const sample = await prisma.notificationPreference.findFirst({
        where: { userId: adminUserId, schoolId, channel: 'EMAIL', trigger: 'SCHEDULE_CHANGE' },
      });
      expect(sample?.enabled).toBe(false);
      expect(sample?.quietStart).toBe('22:00');
      expect(sample?.quietEnd).toBe('07:00');
    });
  });

  // ─── notification log ───────────────────────────────────────────────────────
  describe('getNotificationLog', () => {
    beforeEach(async () => {
      // Seed a small spread of notifications.
      await prisma.notification.createMany({
        data: [
          {
            schoolId,
            userId: adminUserId,
            channel: 'EMAIL',
            trigger: 'SCHEDULE_CHANGE',
            status: 'SENT',
            subject: 'A',
            body: 'A body',
          },
          {
            schoolId,
            userId: adminUserId,
            channel: 'EMAIL',
            trigger: 'CONFLICT_DETECTED',
            status: 'FAILED',
            subject: 'B',
            body: 'B body',
            failedAt: new Date(),
          },
          {
            schoolId,
            userId: coachUserId,
            channel: 'SMS',
            trigger: 'SCHEDULE_CHANGE',
            status: 'SENT',
            subject: 'C',
            body: 'C body',
          },
        ],
      });
    });

    it('returns all notifications for the school with pagination metadata', async () => {
      const result = await notificationService.getNotificationLog(schoolId, {
        page: 1,
        limit: 25,
      });
      expect(result.data).toHaveLength(3);
      expect(result.meta).toEqual({ page: 1, limit: 25, total: 3, totalPages: 1 });
    });

    it('filters by channel', async () => {
      const result = await notificationService.getNotificationLog(schoolId, {
        page: 1,
        limit: 25,
        channel: 'SMS',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].channel).toBe('SMS');
    });

    it('filters by status', async () => {
      const result = await notificationService.getNotificationLog(schoolId, {
        page: 1,
        limit: 25,
        status: 'FAILED',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('FAILED');
    });

    it('paginates results', async () => {
      const p1 = await notificationService.getNotificationLog(schoolId, { page: 1, limit: 2 });
      expect(p1.data).toHaveLength(2);
      expect(p1.meta.totalPages).toBe(2);
      const p2 = await notificationService.getNotificationLog(schoolId, { page: 2, limit: 2 });
      expect(p2.data).toHaveLength(1);
    });

    it('scopes by schoolId (does not leak notifications from another school)', async () => {
      // Create a notification for otherSchoolId belonging to admin (admin is also schooled there for this test).
      await prisma.schoolUser.create({
        data: { userId: adminUserId, schoolId: otherSchoolId, role: 'ADMIN' },
      });
      await prisma.notification.create({
        data: {
          schoolId: otherSchoolId,
          userId: adminUserId,
          channel: 'EMAIL',
          trigger: 'SCHEDULE_CHANGE',
          status: 'SENT',
          subject: 'Other',
          body: 'Other body',
        },
      });
      const result = await notificationService.getNotificationLog(schoolId, {
        page: 1,
        limit: 50,
      });
      expect(result.data.every((n) => n.schoolId === schoolId)).toBe(true);
    });
  });

  // ─── test notifications + rate limit ────────────────────────────────────────
  describe('sendTestNotification', () => {
    beforeEach(() => {
      // Reset in-memory rate-limit map between tests by exhausting the window via vi.useFakeTimers.
      vi.useRealTimers();
    });

    it('sends a test email for users with an email on file', async () => {
      // Use a fresh user so the in-memory rate limit doesn't affect us between runs.
      const u = await prisma.user.create({
        data: { email: `${EMAIL_NS}-test-email@test.com`, passwordHash: 'x' },
      });
      await prisma.schoolUser.create({
        data: { userId: u.id, schoolId, role: 'COACH' },
      });
      try {
        await notificationService.sendTestNotification(u.id, schoolId, 'EMAIL');
        const n = await prisma.notification.findFirst({
          where: { userId: u.id, schoolId, channel: 'EMAIL' },
        });
        expect(n?.status).toBe('SENT');
        expect(n?.subject).toContain('Test');
      } finally {
        await prisma.notification.deleteMany({ where: { userId: u.id } });
        await prisma.schoolUser.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
      }
    });

    it('rejects SMS test for users with no phone on file', async () => {
      await expect(
        notificationService.sendTestNotification(noPhoneUserId, schoolId, 'SMS')
      ).rejects.toBeInstanceOf(AppError);
    });

    it('throws NOT_FOUND for an unknown user', async () => {
      await expect(
        notificationService.sendTestNotification(
          '00000000-0000-0000-0000-000000000000',
          schoolId,
          'EMAIL'
        )
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rate-limits to 5 test notifications per user per hour', async () => {
      const u = await prisma.user.create({
        data: { email: `${EMAIL_NS}-rl@test.com`, passwordHash: 'x' },
      });
      await prisma.schoolUser.create({
        data: { userId: u.id, schoolId, role: 'COACH' },
      });
      try {
        for (let i = 0; i < 5; i++) {
          await notificationService.sendTestNotification(u.id, schoolId, 'EMAIL');
        }
        await expect(
          notificationService.sendTestNotification(u.id, schoolId, 'EMAIL')
        ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
      } finally {
        await prisma.notification.deleteMany({ where: { userId: u.id } });
        await prisma.schoolUser.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
      }
    });
  });

  // ─── opt-out tokens ─────────────────────────────────────────────────────────
  describe('SMS opt-out', () => {
    it('round-trips userId+schoolId via generateOptOutToken / smsOptOut', async () => {
      // Seed an opted-in SMS preference.
      await prisma.notificationPreference.create({
        data: {
          userId: coachUserId,
          schoolId,
          channel: 'SMS',
          trigger: 'SCHEDULE_CHANGE',
          enabled: true,
        },
      });
      const token = notificationService.generateOptOutToken(coachUserId, schoolId);
      await notificationService.smsOptOut(token);

      const after = await prisma.notificationPreference.findMany({
        where: { userId: coachUserId, schoolId, channel: 'SMS' },
      });
      expect(after.every((p) => p.enabled === false)).toBe(true);
    });

    it('does NOT disable EMAIL preferences when SMS opt-out is invoked', async () => {
      await prisma.notificationPreference.create({
        data: {
          userId: coachUserId,
          schoolId,
          channel: 'EMAIL',
          trigger: 'SCHEDULE_CHANGE',
          enabled: true,
        },
      });
      const token = notificationService.generateOptOutToken(coachUserId, schoolId);
      await notificationService.smsOptOut(token);
      const emailPref = await prisma.notificationPreference.findFirst({
        where: { userId: coachUserId, schoolId, channel: 'EMAIL' },
      });
      expect(emailPref?.enabled).toBe(true);
    });

    it('rejects malformed opt-out tokens', async () => {
      // "not a base64-encoded userId:schoolId" decodes to garbage without a colon.
      const bad = Buffer.from('no-colon-here').toString('base64');
      await expect(notificationService.smsOptOut(bad)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('silently succeeds for a valid token with no matching prefs', async () => {
      const token = notificationService.generateOptOutToken(
        '00000000-0000-0000-0000-000000000000',
        schoolId
      );
      await expect(notificationService.smsOptOut(token)).resolves.toBeUndefined();
    });
  });
});

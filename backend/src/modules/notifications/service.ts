// backend/src/modules/notifications/service.ts
import { prisma } from '../../common/db.js';
import { Resend } from 'resend';
import { config } from '../../config.js';
import { AppError } from '../../common/errors.js';
import type { NotificationChannel, NotificationTrigger, NotificationStatus, Prisma } from '@prisma/client';
import type { UpdatePreferencesInput, NotificationLogQuery } from './schemas.js';

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

// In-memory rate limiter for test notifications: userId -> timestamps[]
const testRateLimit = new Map<string, number[]>();
const TEST_RATE_LIMIT = 5;
const TEST_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

// Urgent triggers that bypass quiet hours
const URGENT_TRIGGERS: NotificationTrigger[] = ['WEATHER_ALERT'];

export interface EmitPayload {
  trigger: NotificationTrigger;
  schoolId: string;
  eventType?: 'GAME' | 'PRACTICE' | 'BLOCKER';
  eventId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function buildSubject(trigger: NotificationTrigger, metadata?: Record<string, unknown>): string {
  const subjects: Record<string, string> = {
    CONFLICT_DETECTED: 'Schedule Conflict Detected',
    CONFLICT_RESOLVED: 'Schedule Conflict Resolved',
    SCHEDULE_CHANGE: 'Schedule Update',
    GAME_REMINDER: 'Game Reminder',
    PRACTICE_REMINDER: 'Practice Reminder',
    FACILITY_REQUEST: 'Facility Request',
    CHECKLIST_ASSIGNED: 'Checklist Assigned',
    WEATHER_ALERT: 'Weather Alert',
  };
  return subjects[trigger] || 'AthleticOS Notification';
}

function buildEmailBody(trigger: NotificationTrigger, metadata?: Record<string, unknown>): string {
  const eventType = (metadata?.eventType as string) || 'event';
  const eventId = (metadata?.eventId as string) || '';
  const appUrl = config.APP_URL;

  switch (trigger) {
    case 'SCHEDULE_CHANGE':
      return `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Schedule Update</h2>
          <p>A ${eventType.toLowerCase()} in your school schedule has been updated.</p>
          <p style="margin: 24px 0;">
            <a href="${appUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              View Schedule
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">You can manage your notification preferences in AthleticOS settings.</p>
        </div>
      `;
    case 'WEATHER_ALERT':
      return `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Weather Alert</h2>
          <p>A weather-related blocker has been created that may affect scheduled events.</p>
          <p style="margin: 24px 0;">
            <a href="${appUrl}" style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              View Details
            </a>
          </p>
        </div>
      `;
    case 'CONFLICT_DETECTED':
      return `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Schedule Conflict Detected</h2>
          <p>A new scheduling conflict has been detected. Please review and resolve it.</p>
          <p style="margin: 24px 0;">
            <a href="${appUrl}" style="background: #f59e0b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              View Conflicts
            </a>
          </p>
        </div>
      `;
    case 'CONFLICT_RESOLVED':
      return `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Conflict Resolved</h2>
          <p>A scheduling conflict has been resolved.</p>
          <p style="margin: 24px 0;">
            <a href="${appUrl}" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              View Schedule
            </a>
          </p>
        </div>
      `;
    default:
      return `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>AthleticOS Notification</h2>
          <p>You have a new notification from AthleticOS.</p>
          <p style="margin: 24px 0;">
            <a href="${appUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Open AthleticOS
            </a>
          </p>
        </div>
      `;
  }
}

function buildSmsBody(trigger: NotificationTrigger, metadata?: Record<string, unknown>): string {
  const eventType = (metadata?.eventType as string) || 'Event';
  const appUrl = config.APP_URL;

  const messages: Record<string, string> = {
    SCHEDULE_CHANGE: `[AthleticOS] ${eventType} schedule updated. View: ${appUrl}`,
    WEATHER_ALERT: `[AthleticOS] WEATHER ALERT affecting events. View: ${appUrl}`,
    CONFLICT_DETECTED: `[AthleticOS] Schedule conflict detected. View: ${appUrl}`,
    CONFLICT_RESOLVED: `[AthleticOS] Schedule conflict resolved. View: ${appUrl}`,
    GAME_REMINDER: `[AthleticOS] Game reminder. View: ${appUrl}`,
    PRACTICE_REMINDER: `[AthleticOS] Practice reminder. View: ${appUrl}`,
    FACILITY_REQUEST: `[AthleticOS] Facility request update. View: ${appUrl}`,
    CHECKLIST_ASSIGNED: `[AthleticOS] New checklist assigned. View: ${appUrl}`,
  };

  const msg = messages[trigger] || `[AthleticOS] New notification. View: ${appUrl}`;
  // SMS 160 char limit
  return msg.length > 160 ? msg.substring(0, 157) + '...' : msg;
}

function isInQuietHours(quietStart: string | null, quietEnd: string | null): boolean {
  if (!quietStart || !quietEnd) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export const notificationService = {
  /**
   * Emit a notification to all school members based on trigger.
   * Checks user preferences, quiet hours, and digest mode.
   */
  async emit(payload: EmitPayload): Promise<void> {
    const { trigger, schoolId, eventType, eventId, changes, metadata } = payload;

    // Get all school members with their user info
    const schoolUsers = await prisma.schoolUser.findMany({
      where: { schoolId },
      include: { user: true },
    });

    const subject = buildSubject(trigger, { ...metadata, eventType });
    const enrichedMetadata = { ...metadata, eventType, eventId, changes };

    for (const su of schoolUsers) {
      const user = su.user;

      // Get preferences for each channel
      const prefs = await prisma.notificationPreference.findMany({
        where: { userId: user.id, schoolId, trigger },
      });

      // Build a lookup of channel -> preference
      const prefMap = new Map(prefs.map(p => [p.channel, p]));

      // Process EMAIL channel
      const emailPref = prefMap.get('EMAIL');
      const emailEnabled = emailPref ? emailPref.enabled : true; // default enabled
      if (emailEnabled && user.email) {
        await this.dispatch({
          channel: 'EMAIL',
          trigger,
          schoolId,
          userId: user.id,
          subject,
          body: buildEmailBody(trigger, enrichedMetadata),
          metadata: enrichedMetadata,
          quietStart: emailPref?.quietStart ?? null,
          quietEnd: emailPref?.quietEnd ?? null,
          digestEnabled: emailPref?.digestEnabled ?? false,
          email: user.email,
        });
      }

      // Process SMS channel
      const smsPref = prefMap.get('SMS');
      const smsEnabled = smsPref ? smsPref.enabled : false; // default disabled
      if (smsEnabled && user.phone) {
        await this.dispatch({
          channel: 'SMS',
          trigger,
          schoolId,
          userId: user.id,
          subject,
          body: buildSmsBody(trigger, enrichedMetadata),
          metadata: enrichedMetadata,
          quietStart: smsPref?.quietStart ?? null,
          quietEnd: smsPref?.quietEnd ?? null,
          digestEnabled: smsPref?.digestEnabled ?? false,
          phone: user.phone,
        });
      }
    }
  },

  /**
   * Dispatch a single notification: check quiet hours, digest mode, then send or queue.
   */
  async dispatch(params: {
    channel: NotificationChannel;
    trigger: NotificationTrigger;
    schoolId: string;
    userId: string;
    subject: string;
    body: string;
    metadata: Record<string, unknown>;
    quietStart: string | null;
    quietEnd: string | null;
    digestEnabled: boolean;
    email?: string;
    phone?: string;
  }): Promise<void> {
    const { channel, trigger, schoolId, userId, subject, body, metadata,
            quietStart, quietEnd, digestEnabled, email, phone } = params;

    const isUrgent = URGENT_TRIGGERS.includes(trigger);

    // Queue if in quiet hours (and not urgent) or if digest mode
    if ((!isUrgent && isInQuietHours(quietStart, quietEnd)) || digestEnabled) {
      await prisma.notification.create({
        data: {
          schoolId,
          userId,
          channel,
          trigger,
          status: 'QUEUED',
          subject,
          body,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      return;
    }

    // Send immediately
    if (channel === 'EMAIL' && email) {
      await this.sendEmail(email, subject, body, { schoolId, userId, trigger, metadata });
    } else if (channel === 'SMS' && phone) {
      await this.sendSms(phone, body, { schoolId, userId, trigger, metadata });
    }
  },

  /**
   * Send an email via Resend.
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    context: { schoolId: string; userId: string; trigger: NotificationTrigger; metadata: Record<string, unknown> },
  ): Promise<void> {
    const notification = await prisma.notification.create({
      data: {
        schoolId: context.schoolId,
        userId: context.userId,
        channel: 'EMAIL',
        trigger: context.trigger,
        status: 'QUEUED',
        subject,
        body: html,
        metadata: context.metadata as Prisma.InputJsonValue,
      },
    });

    if (!resend) {
      console.log(`[Notification] No RESEND_API_KEY configured. Would send email to ${to}: ${subject}`);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      return;
    }

    try {
      await resend.emails.send({
        from: 'AthleticOS <notifications@athleticos.co>',
        to,
        subject,
        html,
      });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      console.error(`[Notification] Email send failed:`, err);
      // Retry once
      if (notification.retryCount < 1) {
        try {
          await resend.emails.send({
            from: 'AthleticOS <notifications@athleticos.co>',
            to,
            subject,
            html,
          });
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'SENT', sentAt: new Date(), retryCount: 1 },
          });
        } catch (retryErr) {
          console.error(`[Notification] Email retry failed:`, retryErr);
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              failReason: retryErr instanceof Error ? retryErr.message : 'Unknown error',
              retryCount: 1,
            },
          });
        }
      }
    }
  },

  /**
   * Send an SMS via Resend SMS API.
   */
  async sendSms(
    to: string,
    body: string,
    context: { schoolId: string; userId: string; trigger: NotificationTrigger; metadata: Record<string, unknown> },
  ): Promise<void> {
    const notification = await prisma.notification.create({
      data: {
        schoolId: context.schoolId,
        userId: context.userId,
        channel: 'SMS',
        trigger: context.trigger,
        status: 'QUEUED',
        subject: 'SMS',
        body,
        metadata: context.metadata as Prisma.InputJsonValue,
      },
    });

    if (!resend) {
      console.log(`[Notification] No RESEND_API_KEY configured. Would send SMS to ${to}: ${body}`);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      return;
    }

    try {
      await (resend as any).sms.send({
        from: '+18005550199', // Resend SMS sender
        to,
        text: body,
      });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      console.error(`[Notification] SMS send failed:`, err);
      // Retry once
      if (notification.retryCount < 1) {
        try {
          await (resend as any).sms.send({
            from: '+18005550199',
            to,
            text: body,
          });
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'SENT', sentAt: new Date(), retryCount: 1 },
          });
        } catch (retryErr) {
          console.error(`[Notification] SMS retry failed:`, retryErr);
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              failReason: retryErr instanceof Error ? retryErr.message : 'Unknown error',
              retryCount: 1,
            },
          });
        }
      }
    }
  },

  /**
   * Get notification preferences for a user at a school.
   * Returns defaults if no preferences exist.
   */
  async getPreferences(userId: string, schoolId: string) {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId, schoolId },
    });

    // Also get user phone
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    // Derive summary from channel-level prefs
    const emailPrefs = prefs.filter(p => p.channel === 'EMAIL');
    const smsPrefs = prefs.filter(p => p.channel === 'SMS');

    return {
      emailEnabled: emailPrefs.length === 0 || emailPrefs.some(p => p.enabled),
      smsEnabled: smsPrefs.some(p => p.enabled),
      quietHoursStart: emailPrefs[0]?.quietStart ?? null,
      quietHoursEnd: emailPrefs[0]?.quietEnd ?? null,
      digestMode: emailPrefs[0]?.digestEnabled ?? false,
      digestTime: null as string | null, // stored in metadata if needed
      phone: user?.phone ?? null,
      preferences: prefs,
    };
  },

  /**
   * Update notification preferences for a user at a school.
   * Upserts preferences for all trigger types.
   */
  async updatePreferences(userId: string, schoolId: string, data: UpdatePreferencesInput) {
    const triggers: NotificationTrigger[] = [
      'CONFLICT_DETECTED', 'CONFLICT_RESOLVED', 'SCHEDULE_CHANGE',
      'GAME_REMINDER', 'PRACTICE_REMINDER', 'FACILITY_REQUEST',
      'CHECKLIST_ASSIGNED', 'WEATHER_ALERT',
    ];

    // Update phone on user if provided
    if (data.phone !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { phone: data.phone },
      });
    }

    // Upsert email preferences for all triggers
    if (data.emailEnabled !== undefined || data.quietHoursStart !== undefined ||
        data.quietHoursEnd !== undefined || data.digestMode !== undefined) {
      for (const trigger of triggers) {
        await prisma.notificationPreference.upsert({
          where: {
            userId_schoolId_channel_trigger: {
              userId, schoolId, channel: 'EMAIL', trigger,
            },
          },
          update: {
            ...(data.emailEnabled !== undefined && { enabled: data.emailEnabled }),
            ...(data.quietHoursStart !== undefined && { quietStart: data.quietHoursStart }),
            ...(data.quietHoursEnd !== undefined && { quietEnd: data.quietHoursEnd }),
            ...(data.digestMode !== undefined && { digestEnabled: data.digestMode }),
          },
          create: {
            userId,
            schoolId,
            channel: 'EMAIL',
            trigger,
            enabled: data.emailEnabled ?? true,
            quietStart: data.quietHoursStart ?? null,
            quietEnd: data.quietHoursEnd ?? null,
            digestEnabled: data.digestMode ?? false,
          },
        });
      }
    }

    // Upsert SMS preferences for all triggers
    if (data.smsEnabled !== undefined) {
      for (const trigger of triggers) {
        await prisma.notificationPreference.upsert({
          where: {
            userId_schoolId_channel_trigger: {
              userId, schoolId, channel: 'SMS', trigger,
            },
          },
          update: {
            enabled: data.smsEnabled,
            ...(data.quietHoursStart !== undefined && { quietStart: data.quietHoursStart }),
            ...(data.quietHoursEnd !== undefined && { quietEnd: data.quietHoursEnd }),
          },
          create: {
            userId,
            schoolId,
            channel: 'SMS',
            trigger,
            enabled: data.smsEnabled,
            quietStart: data.quietHoursStart ?? null,
            quietEnd: data.quietHoursEnd ?? null,
          },
        });
      }
    }

    return this.getPreferences(userId, schoolId);
  },

  /**
   * Get paginated notification log for a school (admin view).
   */
  async getNotificationLog(schoolId: string, query: NotificationLogQuery) {
    const { page, limit, channel, status, from, to } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { schoolId };
    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      };
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Send a test notification. Rate limited to 5/hour per user.
   */
  async sendTestNotification(userId: string, schoolId: string, channel: 'EMAIL' | 'SMS'): Promise<void> {
    // Rate limit check
    const now = Date.now();
    const userHistory = testRateLimit.get(userId) || [];
    const recentHistory = userHistory.filter(ts => now - ts < TEST_RATE_WINDOW);

    if (recentHistory.length >= TEST_RATE_LIMIT) {
      throw new AppError('RATE_LIMITED', 'Test notification rate limit exceeded (5 per hour)', 429);
    }

    recentHistory.push(now);
    testRateLimit.set(userId, recentHistory);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });

    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    if (channel === 'EMAIL') {
      if (!user.email) {
        throw new AppError('VALIDATION_ERROR', 'No email address on file', 400);
      }
      await this.sendEmail(
        user.email,
        'AthleticOS Test Notification',
        `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Test Notification</h2>
          <p>This is a test email notification from AthleticOS. If you received this, your email notifications are working correctly.</p>
        </div>`,
        { schoolId, userId, trigger: 'SCHEDULE_CHANGE', metadata: { test: true } },
      );
    } else if (channel === 'SMS') {
      if (!user.phone) {
        throw new AppError('VALIDATION_ERROR', 'No phone number on file. Please add your phone number first.', 400);
      }
      await this.sendSms(
        user.phone,
        '[AthleticOS] Test notification. SMS notifications are working.',
        { schoolId, userId, trigger: 'SCHEDULE_CHANGE', metadata: { test: true } },
      );
    }
  },

  /**
   * Opt out of SMS notifications for a user.
   * Token format: base64(userId:schoolId)
   */
  async smsOptOut(token: string): Promise<void> {
    let userId: string;
    let schoolId: string;

    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length !== 2) throw new Error('Invalid token format');
      userId = parts[0];
      schoolId = parts[1];
    } catch {
      throw new AppError('VALIDATION_ERROR', 'Invalid opt-out token', 400);
    }

    // Disable all SMS preferences for this user at this school
    await prisma.notificationPreference.updateMany({
      where: { userId, schoolId, channel: 'SMS' },
      data: { enabled: false },
    });
  },

  /**
   * Generate an SMS opt-out token for a user.
   */
  generateOptOutToken(userId: string, schoolId: string): string {
    return Buffer.from(`${userId}:${schoolId}`).toString('base64');
  },
};

// backend/src/modules/notifications/schemas.ts
import { z } from 'zod';

const hhmmRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(hhmmRegex, 'Must be HH:MM format').optional().nullable(),
  quietHoursEnd: z.string().regex(hhmmRegex, 'Must be HH:MM format').optional().nullable(),
  digestMode: z.boolean().optional(),
  digestTime: z.string().regex(hhmmRegex, 'Must be HH:MM format').optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

export const notificationLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  channel: z.enum(['EMAIL', 'SMS', 'IN_APP', 'PUSH']).optional(),
  status: z.enum(['QUEUED', 'SENT', 'FAILED', 'DELIVERED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const testNotificationSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS']),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type NotificationLogQuery = z.infer<typeof notificationLogQuerySchema>;
export type TestNotificationInput = z.infer<typeof testNotificationSchema>;

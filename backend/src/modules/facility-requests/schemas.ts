// backend/src/modules/facility-requests/schemas.ts
import { z } from 'zod';

export const createFacilityRequestSchema = z.object({
  facilityId: z.string().min(1),
  type: z.enum(['BOOKING', 'MAINTENANCE', 'SETUP', 'TEARDOWN']).default('BOOKING'),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
});

export const listRequestsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'DENIED', 'CANCELLED']).optional(),
  facilityId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(['APPROVED', 'DENIED', 'CANCELLED']),
  reviewNotes: z.string().max(2000).optional(),
});

export const availabilitySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

export const communityRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  schoolId: z.string().min(1),
});

export type CreateFacilityRequestInput = z.infer<typeof createFacilityRequestSchema>;
export type ListRequestsQuery = z.infer<typeof listRequestsSchema>;
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;
export type AvailabilityQuery = z.infer<typeof availabilitySchema>;
export type CommunityRegisterInput = z.infer<typeof communityRegisterSchema>;

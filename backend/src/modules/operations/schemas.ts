// backend/src/modules/operations/schemas.ts
import { z } from 'zod';

// Template items stored as JSON in OperationsTemplate.items
export const templateItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  assigneeRole: z.string().max(100).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  items: z.array(templateItemSchema).min(1),
});

export const updateChecklistItemSchema = z.object({
  index: z.number().int().min(0),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).optional(),
  assigneeId: z.string().optional().nullable(),
});

export const updateChecklistSchema = z.object({
  tasks: z.array(updateChecklistItemSchema).min(1),
});

export const readinessQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type ReadinessQuery = z.infer<typeof readinessQuerySchema>;

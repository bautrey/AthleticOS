// backend/src/modules/schools/schemas.ts
import { z } from 'zod';
import { weatherPolicySchema } from '../weather/policy.js';

/**
 * Settings is an open bag by design, but the weather block is validated on write.
 *
 * An unvalidated typo there does not fail loudly: the scan reads it, cannot parse
 * it, and falls back to raising nothing. Someone would then believe heat alerts
 * were configured while none could ever fire. Rejecting it at the boundary is the
 * difference between a form error and a silent gap.
 */
const settingsSchema = z
  .record(z.unknown())
  .superRefine((settings, ctx) => {
    if (settings.weather === undefined) return;
    const parsed = weatherPolicySchema.safeParse(settings.weather);
    if (parsed.success) return;
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weather', ...issue.path],
        message: issue.message,
      });
    }
  });

export const createSchoolSchema = z.object({
  name: z.string().min(1).max(255),
  timezone: z.string().default('America/New_York'),
  // Where the school is, for weather. Null clears it, and a school with no
  // coordinates is skipped by the scan rather than forecast for a guessed place.
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  settings: settingsSchema.optional(),
});

export const updateSchoolSchema = createSchoolSchema.partial();

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;

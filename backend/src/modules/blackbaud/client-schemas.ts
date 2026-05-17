// backend/src/modules/blackbaud/client-schemas.ts
//
// Zod schemas for SKY API responses. Verified against:
//   https://bbapiprod.developer.azure-api.net/developer/apis/school/operations/{opId}?api-version=2022-04-01-preview
// (these are the same payload shapes the developer.blackbaud.com SPA loads at runtime —
// the public docs page is an Angular SPA, but its operation specs come from the Azure API
// Management export above.)
//
// Schemas are deliberately permissive on optional fields — Blackbaud sometimes returns
// nulls or omits fields depending on user role / data presence. We require only the fields
// our code actually reads downstream.
import { z } from 'zod';

// ============ Generic envelope ============
//
// All collection endpoints return { count, value: [...] }. Confirmed across
// V1AthleticsTeamsGet, V1AthleticsSchedulesGet, V1AthleticsTeamsByTeam_idRosterGet,
// V1EventsListPost.
export const skyCollectionEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    count: z.number().int().nonnegative().optional(),
    value: z.array(item),
  });

// ============ Athletics teams ============
// GET /school/v1/athletics/teams[?school_year=...]
//
// Live response example (per V1AthleticsTeamsGet):
//   { count: 2, value: [{ id: 4316266, name: "Average Joes", sport: { id: 31080, name: "Dodgeball" }}] }
export const skyTeamSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  sport: z.object({
    id: z.number().int(),
    name: z.string(),
  }),
});
export type SkyTeam = z.infer<typeof skyTeamSchema>;
export const skyTeamCollectionSchema = skyCollectionEnvelope(skyTeamSchema);

// ============ Athletics schedules ============
// GET /school/v1/athletics/schedules?team_id=&start_date=&end_date=&include_practice=true
//
// NOTE: there is no `GET /v1/athletics/teams/{id}/schedule`. The team-nested route is
// POST/PATCH/DELETE only. To read a team's schedule, query /v1/athletics/schedules with
// team_id as a query param.
//
// Live response example fields used: id, team_id, title, start_time, end_time,
// home_or_away ("Home"|"Away"|"Neutral"), practice (bool), cancelled (bool), location,
// scrimmage (bool), opponents[] (game opponents). Many other fields exist; see
// V1AthleticsSchedulesGet response example for the full set.
export const skyScheduleEntrySchema = z.object({
  id: z.number().int(),
  team_id: z.number().int(),
  title: z.string().nullish(),
  start_time: z.string().nullish(),
  end_time: z.string().nullish(),
  game_date: z.string().nullish(),       // ISO date-time
  home_or_away: z.string().nullish(),    // "Home" | "Away" | "Neutral"
  practice: z.boolean().optional(),
  scrimmage: z.boolean().optional(),
  cancelled: z.boolean().optional(),
  rescheduled: z.boolean().optional(),
  rescheduled_date: z.string().nullish(),
  location: z.string().nullish(),
  description: z.string().nullish(),
  opponents: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        score: z.string().nullish(),
        win_loss: z.string().nullish(),
      })
    )
    .optional(),
});
export type SkyScheduleEntry = z.infer<typeof skyScheduleEntrySchema>;
export const skyScheduleCollectionSchema = skyCollectionEnvelope(skyScheduleEntrySchema);

// ============ Athletics roster ============
// GET /school/v1/athletics/teams/{team_id}/roster
//
// Note the unusual response shape: NOT a plain collection envelope. Instead:
//   { id: <team_id>, coaches: { count, value: [...] }, players: { count, value: [...] } }
// (per V1AthleticsTeamsByTeam_idRosterGet response example)
export const skyRosterCoachSchema = z.object({
  id: z.number().int(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  preferred_name: z.string().nullish(),
  title: z.string().nullish(),
});
export const skyRosterPlayerSchema = z.object({
  id: z.number().int(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  preferred_name: z.string().nullish(),
  jersey: z.number().int().nullish(),
  position: z.string().nullish(),
  team_captain: z.boolean().optional(),
  returning_letter: z.boolean().optional(),
  height: z.string().nullish(),
  weight: z.string().nullish(),
  hometown: z.string().nullish(),
  accolades: z.string().nullish(),
  publish_name: z.boolean().optional(),
  publish_height: z.boolean().optional(),
  publish_weight: z.boolean().optional(),
  publish_photo: z.boolean().optional(),
});
export const skyRosterSchema = z.object({
  id: z.number().int(),
  coaches: z.object({
    count: z.number().int().optional(),
    value: z.array(skyRosterCoachSchema),
  }),
  players: z.object({
    count: z.number().int().optional(),
    value: z.array(skyRosterPlayerSchema),
  }),
});
export type SkyRoster = z.infer<typeof skyRosterSchema>;
export type SkyRosterCoach = z.infer<typeof skyRosterCoachSchema>;
export type SkyRosterPlayer = z.infer<typeof skyRosterPlayerSchema>;

// ============ Master events list ============
// POST /school/v1/events/list
//
// Request body (per V1EventsListPost.request.examples.default):
//   { categories?: [{id, type}], start_date: "ISO8601", end_date: "ISO8601",
//     last_modified?: "ISO8601", show_secured?: bool }
// Response: ARRAY of event objects (NOT wrapped in {count, value} — confirmed by
// V1EventsListPost.responses.examples.default which shows `value: [ ... ]` at the top
// level, meaning the response body itself IS the array).
export const skyEventCategorySchema = z.object({
  id: z.number().int(),
  name: z.string().nullish(),
  primary: z.boolean().optional(),
});
export const skyEventLocationSchema = z.object({
  type: z.string().nullish(),    // "Existing" | "OffSite" etc.
  room_id: z.number().int().nullish(),
  name: z.string().nullish(),
});
export const skyEventSchema = z.object({
  id: z.number().int(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  details: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  start_time: z.string().nullish(),
  end_time: z.string().nullish(),
  recurring: z.boolean().optional(),
  location: skyEventLocationSchema.nullish(),
  categories: z.array(skyEventCategorySchema).optional(),
  featured: z.boolean().optional(),
  show_details: z.boolean().optional(),
  show_description: z.boolean().optional(),
  created_by: z.number().int().nullish(),
  modified_by: z.number().int().nullish(),
  created_date: z.string().nullish(),
  modified_date: z.string().nullish(),
});
export type SkyEvent = z.infer<typeof skyEventSchema>;

// Body for POST /v1/events/list
export const skyEventsListRequestSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  last_modified: z.string().optional(),
  show_secured: z.boolean().optional(),
  categories: z
    .array(
      z.object({
        id: z.number().int(),
        type: z.string().nullish(),
      })
    )
    .optional(),
});
export type SkyEventsListRequest = z.infer<typeof skyEventsListRequestSchema>;

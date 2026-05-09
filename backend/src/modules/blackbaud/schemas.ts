// backend/src/modules/blackbaud/schemas.ts
import { z } from 'zod';

// Query params Blackbaud sends to our /auth/blackbaud/callback endpoint after the user
// authorizes (or denies) us. Per RFC 6749, on success we get { code, state }; on error
// we get { error, error_description, state }.
export const oauthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type OAuthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;

// /api/v1/blackbaud/connect — must specify which school we're connecting on behalf of.
export const connectQuerySchema = z.object({
  schoolId: z.string().min(1),
  // Optional: if true, redirect immediately instead of returning the URL.
  redirect: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type ConnectQuery = z.infer<typeof connectQuerySchema>;

export const statusQuerySchema = z.object({
  schoolId: z.string().min(1),
});

export type StatusQuery = z.infer<typeof statusQuerySchema>;

export const disconnectBodySchema = z.object({
  schoolId: z.string().min(1),
});

export type DisconnectBody = z.infer<typeof disconnectBodySchema>;

// Shape of a successful Blackbaud OAuth token response.
// Docs: https://developer.blackbaud.com/skyapi/docs/authorization/auth-code-flow/tutorial
export const blackbaudTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string().default('Bearer'),
  expires_in: z.number(), // seconds until access_token expires (typically 3600)
  scope: z.string().optional(),
  environment_id: z.string().optional(),
  environment_name: z.string().optional(),
});

export type BlackbaudTokenResponse = z.infer<typeof blackbaudTokenResponseSchema>;

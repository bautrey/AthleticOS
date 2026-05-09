// backend/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_URL: z.string().default('http://localhost:3005'),
  IDEAS_API_URL: z.string().default('https://ideas.fortiumsoftware.com'),
  IDEAS_API_KEY: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  APP_URL: z.string().default('http://localhost:3005'),

  // Blackbaud SKY API integration
  // App ID is the public OAuth client_id — safe to bake in as default.
  BLACKBAUD_APP_ID: z.string().default('e060cf3f-d079-469b-824b-43e2f0b0dfca'),
  BLACKBAUD_APP_SECRET: z.string().default(''),
  BLACKBAUD_SUBSCRIPTION_KEY: z.string().default(''),
  BLACKBAUD_MODE: z.enum(['mock', 'live']).default('mock'),
  // Where the OAuth callback lives. Must match a redirect URI registered with Blackbaud.
  BLACKBAUD_REDIRECT_URI: z.string().default('http://localhost:8003/auth/blackbaud/callback'),
});

export const config = envSchema.parse(process.env);

// Cross-field validation: if MODE=live, secret + subscription key must be set.
if (config.BLACKBAUD_MODE === 'live') {
  const missing: string[] = [];
  if (!config.BLACKBAUD_APP_SECRET) missing.push('BLACKBAUD_APP_SECRET');
  if (!config.BLACKBAUD_SUBSCRIPTION_KEY) missing.push('BLACKBAUD_SUBSCRIPTION_KEY');
  if (missing.length > 0) {
    throw new Error(
      `BLACKBAUD_MODE=live but missing required env vars: ${missing.join(', ')}. ` +
      `Set them via macOS keychain (see backend/CLAUDE.md) or Render env vars, ` +
      `or set BLACKBAUD_MODE=mock to use canned fixtures.`
    );
  }
}

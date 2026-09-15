// backend/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Bind address. Empty means "decide from NODE_ENV" - see resolveHost below.
  HOST: z.string().default(''),
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
  // OAuth scopes to request. Space-separated. Default = offline_access only — Blackbaud
  // SKY does NOT use per-API scopes (access is governed by the authorizing user's
  // permissions in their environment, e.g. Athletic Group Manager / Calendar Manager).
  // Their OIDC discovery doc (https://oauth2.sky.blackbaud.com/.well-known/openid-configuration)
  // omits `scopes_supported`, confirming this. `offline_access` is required to get a
  // refresh_token back. Override here only if Blackbaud documents new scopes later.
  BLACKBAUD_SCOPES: z.string().default('offline_access'),
});

export const config = envSchema.parse(process.env);

/**
 * The address the server binds to.
 *
 * The bind address is the security boundary on Burke's machine, not the firewall:
 * the macOS App Firewall auto-allows signed software and carries no per-app rules,
 * so a dev server on 0.0.0.0 is reachable by every device on the LAN and the
 * tailnet. This previously served a .env full of live production secrets to the
 * house for a day, from a different repo.
 *
 * So local development binds loopback. Two callers genuinely need every interface
 * and both are handled explicitly rather than by widening the default:
 *
 *   - Production. Render routes to the container from outside it, so a loopback
 *     bind is invisible and the service is simply down. NODE_ENV=production keeps
 *     that working without anyone having to remember a variable.
 *   - Docker Compose. The published port maps into the container's own network
 *     namespace, which loopback-inside-the-container does not answer. compose sets
 *     HOST explicitly so this does not silently depend on NODE_ENV.
 *
 * An explicit HOST always wins, which is also how you bind the tailnet address
 * (HOST=100.x.y.z) when something really does need to reach a phone.
 */
export function resolveHost(env: NodeJS.ProcessEnv = process.env): string {
  if (config.HOST) return config.HOST;

  // NODE_ENV alone is not enough to decide this. The schema defaults it to
  // 'development', so a deployment that simply never sets it would bind loopback
  // and go dark with a healthy-looking process - an outage, not a degradation.
  // Render sets RENDER on every service, so treat that as deployed regardless.
  // The asymmetry is deliberate: guessing "deployed" costs LAN exposure on a
  // machine, guessing "local" costs a production outage.
  const looksDeployed = config.NODE_ENV === 'production' || Boolean(env.RENDER);
  return looksDeployed ? '0.0.0.0' : '127.0.0.1';
}

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

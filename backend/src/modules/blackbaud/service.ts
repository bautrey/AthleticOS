// backend/src/modules/blackbaud/service.ts
import crypto from 'node:crypto';
import { prisma } from '../../common/db.js';
import { config } from '../../config.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../common/errors.js';
import { blackbaudTokenResponseSchema, type BlackbaudTokenResponse } from './schemas.js';

// Blackbaud OAuth + API endpoints. These are constant for the SKY API.
// Docs: https://developer.blackbaud.com/skyapi/docs/authorization
export const BLACKBAUD_AUTHORIZE_URL = 'https://oauth2.sky.blackbaud.com/authorization';
export const BLACKBAUD_TOKEN_URL = 'https://oauth2.sky.blackbaud.com/token';

// Scopes we request. SKY's standard for SIS/Education Edge.
// Burke can tighten/expand this list once Blackbaud confirms exact scope strings during testing.
// TODO: verify exact scope names when running first live OAuth — Blackbaud's docs are
// a bit thin on whether scopes are space- or comma-separated and what each one is named.
const DEFAULT_SCOPES = ['offline_access'];

interface OAuthStatePayload {
  schoolId: string;
  nonce: string;
  type: 'blackbaud_oauth_state';
  exp: number; // ms epoch
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const blackbaudService = {
  /**
   * Build the Blackbaud authorize URL the user should be sent to.
   * Encodes the schoolId in a signed JWT state token so the callback can recover it
   * without trusting the client.
   */
  buildAuthorizeUrl(schoolId: string): string {
    const state = this.signStateToken(schoolId);
    const params = new URLSearchParams({
      client_id: config.BLACKBAUD_APP_ID,
      response_type: 'code',
      redirect_uri: config.BLACKBAUD_REDIRECT_URI,
      state,
    });
    if (DEFAULT_SCOPES.length > 0) {
      params.set('scope', DEFAULT_SCOPES.join(' '));
    }
    return `${BLACKBAUD_AUTHORIZE_URL}?${params.toString()}`;
  },

  /**
   * Sign a short-lived state token (10 min) carrying the schoolId + a random nonce.
   * Format: base64url(payload).base64url(hmac). HMAC-SHA256 keyed on JWT_SECRET.
   * Using a custom format (vs. JWT) avoids pulling in jsonwebtoken just for this.
   */
  signStateToken(schoolId: string, ttlMs = 10 * 60 * 1000): string {
    const payload: OAuthStatePayload = {
      schoolId,
      nonce: crypto.randomBytes(16).toString('hex'),
      type: 'blackbaud_oauth_state',
      exp: Date.now() + ttlMs,
    };
    const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
    const sig = base64url(
      crypto.createHmac('sha256', config.JWT_SECRET).update(payloadB64).digest()
    );
    return `${payloadB64}.${sig}`;
  },

  /**
   * Verify state token came from us. Throws on tampering or expiration.
   */
  verifyStateToken(state: string): OAuthStatePayload {
    const parts = state.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedError('Malformed OAuth state token');
    }
    const [payloadB64, sig] = parts;
    const expectedSig = base64url(
      crypto.createHmac('sha256', config.JWT_SECRET).update(payloadB64).digest()
    );
    // Constant-time compare to prevent timing attacks.
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new UnauthorizedError('Invalid OAuth state token signature');
    }
    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedError('Malformed OAuth state token payload');
    }
    if (
      payload.type !== 'blackbaud_oauth_state' ||
      typeof payload.schoolId !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedError('Malformed OAuth state token');
    }
    if (payload.exp < Date.now()) {
      throw new UnauthorizedError('OAuth state token expired');
    }
    return payload;
  },

  /**
   * Exchange an authorization code for tokens via Blackbaud's token endpoint.
   * Uses HTTP Basic auth with client_id:client_secret per RFC 6749.
   */
  async exchangeCodeForTokens(code: string): Promise<BlackbaudTokenResponse> {
    if (!config.BLACKBAUD_APP_SECRET) {
      throw new ValidationError(
        'BLACKBAUD_APP_SECRET is not configured — cannot complete OAuth flow'
      );
    }
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.BLACKBAUD_REDIRECT_URI,
    });
    const basic = Buffer.from(
      `${config.BLACKBAUD_APP_ID}:${config.BLACKBAUD_APP_SECRET}`
    ).toString('base64');

    const res = await fetch(BLACKBAUD_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ValidationError(
        `Blackbaud token exchange failed (${res.status}): ${text.slice(0, 500)}`
      );
    }

    const json = await res.json();
    return blackbaudTokenResponseSchema.parse(json);
  },

  /**
   * Refresh an access token using its refresh token. Same auth pattern as the code exchange.
   */
  async refreshAccessToken(refreshToken: string): Promise<BlackbaudTokenResponse> {
    if (!config.BLACKBAUD_APP_SECRET) {
      throw new ValidationError(
        'BLACKBAUD_APP_SECRET is not configured — cannot refresh token'
      );
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const basic = Buffer.from(
      `${config.BLACKBAUD_APP_ID}:${config.BLACKBAUD_APP_SECRET}`
    ).toString('base64');

    const res = await fetch(BLACKBAUD_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new UnauthorizedError(
        `Blackbaud token refresh failed (${res.status}): ${text.slice(0, 500)}`
      );
    }

    const json = await res.json();
    return blackbaudTokenResponseSchema.parse(json);
  },

  /**
   * Persist a token response to the BlackbaudConnection table (upsert by schoolId).
   */
  async saveConnection(schoolId: string, tokens: BlackbaudTokenResponse) {
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    return prisma.blackbaudConnection.upsert({
      where: { schoolId },
      create: {
        schoolId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        tokenType: tokens.token_type ?? 'Bearer',
        scope: tokens.scope ?? null,
        environmentId: tokens.environment_id ?? null,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        tokenType: tokens.token_type ?? 'Bearer',
        scope: tokens.scope ?? null,
        // Only overwrite environmentId if the response includes one.
        ...(tokens.environment_id ? { environmentId: tokens.environment_id } : {}),
      },
    });
  },

  /**
   * Fetch a connection, refreshing the access token if it's expired or about to expire.
   * Returns the connection with a fresh access token.
   */
  async getConnectionWithFreshToken(schoolId: string) {
    const conn = await prisma.blackbaudConnection.findUnique({ where: { schoolId } });
    if (!conn) throw new NotFoundError('BlackbaudConnection', schoolId);

    // Refresh if expiring within the next 60 seconds.
    const skewMs = 60 * 1000;
    if (conn.expiresAt.getTime() - skewMs > Date.now()) {
      return conn;
    }

    const refreshed = await this.refreshAccessToken(conn.refreshToken);
    return this.saveConnection(schoolId, refreshed);
  },

  /**
   * Drop a connection (user-initiated disconnect).
   */
  async disconnect(schoolId: string) {
    const existing = await prisma.blackbaudConnection.findUnique({ where: { schoolId } });
    if (!existing) return; // idempotent
    await prisma.blackbaudConnection.delete({ where: { schoolId } });
  },

  /**
   * Status payload for /api/v1/blackbaud/status.
   */
  async getStatus(schoolId: string) {
    const conn = await prisma.blackbaudConnection.findUnique({ where: { schoolId } });
    if (!conn) {
      return { connected: false, mode: config.BLACKBAUD_MODE };
    }
    return {
      connected: true,
      mode: config.BLACKBAUD_MODE,
      scope: conn.scope,
      environmentId: conn.environmentId,
      expiresAt: conn.expiresAt.toISOString(),
      tokenType: conn.tokenType,
      connectedAt: conn.createdAt.toISOString(),
    };
  },
};

// backend/src/modules/blackbaud/oauth.test.ts
// Token exchange + refresh — uses fetch mocking via vi.spyOn(globalThis, 'fetch').
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { blackbaudService, BLACKBAUD_TOKEN_URL } from './service.js';

// Helper: build a fetch Response with a JSON body.
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('blackbaudService.exchangeCodeForTokens', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Config is parsed at module load — BLACKBAUD_APP_SECRET must be set in the env when
    // the test runner starts (see test:blackbaud script in package.json).
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('POSTs to the Blackbaud token endpoint with Basic auth and url-encoded body', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'offline_access',
        environment_id: 'env-tca',
      }) as any
    );

    const result = await blackbaudService.exchangeCodeForTokens('auth-code-xyz');

    expect(result.access_token).toBe('access-1');
    expect(result.refresh_token).toBe('refresh-1');
    expect(result.environment_id).toBe('env-tca');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(BLACKBAUD_TOKEN_URL);
    const initObj = init as RequestInit;
    expect(initObj.method).toBe('POST');
    const headers = new Headers(initObj.headers);
    expect(headers.get('content-type')).toBe('application/x-www-form-urlencoded');
    expect(headers.get('authorization')).toMatch(/^Basic /);

    const decoded = Buffer.from(
      headers.get('authorization')!.replace('Basic ', ''),
      'base64'
    ).toString('utf8');
    // Format: client_id:client_secret
    expect(decoded).toContain(':');
    expect(decoded.split(':')[1]).toBeTruthy();

    expect(initObj.body).toBeTruthy();
    const params = new URLSearchParams(initObj.body as string);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('auth-code-xyz');
    expect(params.get('redirect_uri')).toBeTruthy();
  });

  it('throws ValidationError when Blackbaud returns 400', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(400, { error: 'invalid_grant' }) as any);

    await expect(blackbaudService.exchangeCodeForTokens('bad-code')).rejects.toThrow(
      /token exchange failed/i
    );
  });
});

describe('blackbaudService.refreshAccessToken', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Same caveat as exchange tests — BLACKBAUD_APP_SECRET must be in the env at startup.
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('POSTs grant_type=refresh_token with the refresh token in the body', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        access_token: 'access-2',
        refresh_token: 'refresh-2',
        token_type: 'Bearer',
        expires_in: 3600,
      }) as any
    );

    const result = await blackbaudService.refreshAccessToken('old-refresh');
    expect(result.access_token).toBe('access-2');

    const [, init] = fetchSpy.mock.calls[0];
    const params = new URLSearchParams((init as RequestInit).body as string);
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('old-refresh');
  });

  it('throws UnauthorizedError on 401 (refresh token revoked)', async () => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(401, { error: 'invalid_grant' }) as any);

    await expect(blackbaudService.refreshAccessToken('revoked')).rejects.toThrow(
      /token refresh failed/i
    );
  });
});

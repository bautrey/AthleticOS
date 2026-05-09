// backend/src/modules/blackbaud/service.test.ts
// State token sign/verify tests — no DB or HTTP needed.
import { describe, it, expect } from 'vitest';
import { blackbaudService, BLACKBAUD_AUTHORIZE_URL } from './service.js';

describe('blackbaudService.signStateToken / verifyStateToken', () => {
  it('round-trips a schoolId through sign/verify', () => {
    const token = blackbaudService.signStateToken('school-abc');
    const decoded = blackbaudService.verifyStateToken(token);
    expect(decoded.schoolId).toBe('school-abc');
    expect(decoded.type).toBe('blackbaud_oauth_state');
    expect(decoded.nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(decoded.exp).toBeGreaterThan(Date.now());
  });

  it('rejects a tampered payload', () => {
    const token = blackbaudService.signStateToken('school-abc');
    const [payload, sig] = token.split('.');
    // Flip one bit of the payload — sig should no longer match.
    const tamperedPayload = payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A');
    expect(() =>
      blackbaudService.verifyStateToken(`${tamperedPayload}.${sig}`)
    ).toThrow(/signature/i);
  });

  it('rejects a malformed token (no dot)', () => {
    expect(() => blackbaudService.verifyStateToken('garbage-no-dot')).toThrow(/malformed/i);
  });

  it('rejects an expired token', () => {
    const expired = blackbaudService.signStateToken('school-abc', /* ttlMs */ -1000);
    expect(() => blackbaudService.verifyStateToken(expired)).toThrow(/expired/i);
  });

  it('two tokens for the same schoolId have different nonces', () => {
    const t1 = blackbaudService.signStateToken('school-abc');
    const t2 = blackbaudService.signStateToken('school-abc');
    expect(t1).not.toBe(t2);
    const d1 = blackbaudService.verifyStateToken(t1);
    const d2 = blackbaudService.verifyStateToken(t2);
    expect(d1.nonce).not.toBe(d2.nonce);
  });
});

describe('blackbaudService.buildAuthorizeUrl', () => {
  it('builds a Blackbaud authorize URL with the right params', () => {
    const url = new URL(blackbaudService.buildAuthorizeUrl('school-abc'));
    expect(`${url.origin}${url.pathname}`).toBe(BLACKBAUD_AUTHORIZE_URL);
    expect(url.searchParams.get('client_id')).toBeTruthy();
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();

    // State should round-trip back to the same schoolId.
    const state = url.searchParams.get('state')!;
    const decoded = blackbaudService.verifyStateToken(state);
    expect(decoded.schoolId).toBe('school-abc');
  });
});

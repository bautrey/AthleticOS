// backend/src/modules/blackbaud/token-crypto.test.ts
// Round-trip + tamper detection for the AES-256-GCM token encryption helper.
import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken, isEncrypted } from './token-crypto.js';

describe('token-crypto', () => {
  it('round-trips a token through encrypt → decrypt', () => {
    const plaintext = 'sky-access-token-abc123.def456-very-long-bearer-token-string';
    const ciphertext = encryptToken(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.startsWith('v1:')).toBe(true);
    expect(isEncrypted(ciphertext)).toBe(true);
    const decrypted = decryptToken(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('round-trips refresh tokens (longer payloads)', () => {
    const plaintext = 'r'.repeat(512);
    const ct = encryptToken(plaintext);
    expect(decryptToken(ct)).toBe(plaintext);
  });

  it('produces a different ciphertext each call (random IV)', () => {
    const plaintext = 'same-plaintext';
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(plaintext);
    expect(decryptToken(b)).toBe(plaintext);
  });

  it('passes through empty strings without encrypting', () => {
    expect(encryptToken('')).toBe('');
    expect(decryptToken('')).toBe('');
  });

  it('passes through legacy plaintext (no v1: prefix) unchanged on decrypt', () => {
    const legacy = 'pre-encryption-row-token';
    expect(isEncrypted(legacy)).toBe(false);
    expect(decryptToken(legacy)).toBe(legacy);
  });

  it('rejects a tampered ciphertext (auth tag mismatch)', () => {
    const ct = encryptToken('sensitive-token');
    const parts = ct.split(':');
    // Flip one base64url char in the ciphertext segment.
    const cipherSeg = parts[3];
    const tampered = cipherSeg[0] === 'A' ? `B${cipherSeg.slice(1)}` : `A${cipherSeg.slice(1)}`;
    const bad = `${parts[0]}:${parts[1]}:${parts[2]}:${tampered}`;
    expect(() => decryptToken(bad)).toThrow();
  });

  it('rejects a malformed v1 token (wrong segment count)', () => {
    expect(() => decryptToken('v1:onlytwo')).toThrow(/format/i);
    expect(() => decryptToken('v1:a:b:c:d:e')).toThrow(/format/i);
  });
});

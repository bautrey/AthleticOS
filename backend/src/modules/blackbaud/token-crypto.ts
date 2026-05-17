// backend/src/modules/blackbaud/token-crypto.ts
//
// AES-256-GCM encryption for OAuth tokens at rest. Used to wrap access_token /
// refresh_token before persisting in `blackbaud_connections`.
//
// Key derivation: HKDF-SHA256(JWT_SECRET, info="athleticos:blackbaud:token-v1") -> 32 bytes.
// Using HKDF (per RFC 5869) gives us a domain-separated key without a new env var.
// Bumping the `info` string would let us rotate keys later without breaking the JWT secret.
//
// Stored format (single string column):
//   v1:<base64url(iv)>:<base64url(authTag)>:<base64url(ciphertext)>
//
// The leading "v1:" tag lets us detect already-encrypted vs. plaintext rows during
// migrations and to add a v2 format in the future without ambiguity.
import crypto from 'node:crypto';
import { config } from '../../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard IV length
const KEY_BYTES = 32; // AES-256
const VERSION_TAG = 'v1';
const HKDF_INFO = 'athleticos:blackbaud:token-v1';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  // hkdfSync: (digest, ikm, salt, info, keyLen)
  // Empty salt is acceptable here per RFC 5869 §3.1; the `info` string provides
  // domain separation. JWT_SECRET is already enforced ≥32 chars by config.ts.
  const derived = crypto.hkdfSync(
    'sha256',
    Buffer.from(config.JWT_SECRET, 'utf8'),
    Buffer.alloc(0),
    Buffer.from(HKDF_INFO, 'utf8'),
    KEY_BYTES
  );
  cachedKey = Buffer.from(derived);
  return cachedKey;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  // Buffer.from supports 'base64url' on Node 18+.
  return Buffer.from(s, 'base64url');
}

/**
 * Encrypt a token (string) with AES-256-GCM. Returns a string of the form
 * `v1:<iv>:<authTag>:<ciphertext>` (each part base64url-encoded).
 *
 * Empty / falsy inputs are returned as-is — useful for nullable refresh tokens
 * during migration windows. Never log the inputs or outputs.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION_TAG}:${b64url(iv)}:${b64url(tag)}:${b64url(ct)}`;
}

/**
 * Decrypt a value previously produced by encryptToken. If the input doesn't have the
 * `v1:` prefix, it's treated as legacy plaintext and returned as-is — this keeps the
 * read path safe when rolling out encryption against an existing table that may have
 * unencrypted rows. Once all rows are migrated, callers can switch to strict mode.
 */
export function decryptToken(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(`${VERSION_TAG}:`)) {
    // Legacy / not-yet-encrypted row. Return verbatim.
    return stored;
  }
  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted token format');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = fromB64url(ivB64);
  const tag = fromB64url(tagB64);
  const ct = fromB64url(ctB64);
  if (iv.length !== IV_BYTES) {
    throw new Error(`Invalid IV length: ${iv.length}`);
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/**
 * True if the value already looks like our encrypted format. Useful for tests / migrations.
 */
export function isEncrypted(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith(`${VERSION_TAG}:`);
}

// Test-only: clear the cached key so tests that mutate JWT_SECRET (none currently) work.
export function _resetKeyCacheForTests(): void {
  cachedKey = null;
}

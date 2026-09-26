// backend/src/modules/inbound/address.ts
//
// The address a school's scheduled reports are sent to.
//
// An inbound mailbox is an unauthenticated write path. Anyone who learns the
// address can mail us a spreadsheet, and the only thing separating a stranger's
// file from a school's review queue is whether they can name the address. So the
// local part is random rather than derived from the school: `tca@in.athleticos.co`
// would be guessable from the school's own name, and would also let anyone
// enumerate which schools we have.
//
// This is defence in depth, not the whole defence. Provider signature checks run
// on every delivery, and nothing an inbound file contains reaches a schedule until
// a person approves it.

import { randomBytes } from 'node:crypto';
import { config } from '../../config.js';

/**
 * Crockford base32 without I, L, O or U.
 *
 * Somebody at the school types this into SchoolDude's recipient field, so the
 * characters that get misread by eye or by hand are out. U is dropped as well,
 * which is Crockford's own convention for avoiding accidental words.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** 20 characters of this alphabet is ~100 bits. Not brute-forceable by mail. */
const TOKEN_LENGTH = 20;

/**
 * A fresh inbound token.
 *
 * Rejection sampling rather than a bare modulo. With 32 characters a modulo of a
 * random byte happens to be unbiased, so this changes nothing today; it is here
 * so that editing the alphabet later cannot quietly skew the distribution.
 */
export function generateInboundToken(): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let token = '';
  while (token.length < TOKEN_LENGTH) {
    for (const byte of randomBytes(TOKEN_LENGTH)) {
      if (byte >= limit) continue;
      token += ALPHABET[byte % ALPHABET.length];
      if (token.length === TOKEN_LENGTH) break;
    }
  }
  return token;
}

/** The full address for a token, e.g. "v3k9…@in.athleticos.co". */
export function inboundAddress(token: string): string {
  return `${token}@${config.INBOUND_EMAIL_DOMAIN}`;
}

/**
 * The token out of a recipient address, or null if it is not one of ours.
 *
 * Handles what mail actually looks like on the wire: a display name wrapper
 * ("TCA Imports <abc@in.athleticos.co>"), mixed case, and plus-addressing, which
 * some senders add and which must not change which school we resolve.
 */
export function tokenFromAddress(recipient: string): string | null {
  const angled = /<([^>]+)>/.exec(recipient);
  const bare = (angled ? angled[1] : recipient).trim().toLowerCase();

  const at = bare.lastIndexOf('@');
  if (at === -1) return null;

  const domain = bare.slice(at + 1);
  if (domain !== config.INBOUND_EMAIL_DOMAIN.toLowerCase()) return null;

  // Strip a +suffix, so abc+september@… still resolves to abc.
  const local = bare.slice(0, at).split('+')[0];
  return /^[0-9a-hjkmnp-tv-z]{8,64}$/.test(local) ? local : null;
}

/**
 * Every recipient on the message, since the school's address may be in Cc rather
 * than To - a Saved Action with several recipients puts them all in one header.
 */
export function tokensFromRecipients(recipients: readonly string[]): string[] {
  const tokens = new Set<string>();
  for (const recipient of recipients) {
    // One header can hold several addresses.
    for (const part of recipient.split(',')) {
      const token = tokenFromAddress(part);
      if (token) tokens.add(token);
    }
  }
  return [...tokens];
}

// backend/src/modules/inbound/address.test.ts
//
// The address is a credential. Everything here defends that: it has to be
// unguessable, it has to survive the mangling real mail applies to a recipient
// header, and it must never resolve for a domain that is not ours.

import { describe, it, expect } from 'vitest';
import {
  generateInboundToken,
  inboundAddress,
  tokenFromAddress,
  tokensFromRecipients,
} from './address.js';
import { config } from '../../config.js';

const DOMAIN = config.INBOUND_EMAIL_DOMAIN;

describe('generateInboundToken', () => {
  it('uses only characters that survive being read off a screen and typed', () => {
    // Somebody at the school types this into SchoolDude. i, l, o and u are out.
    for (let i = 0; i < 200; i++) {
      expect(generateInboundToken()).toMatch(/^[0-9a-hjkmnp-tv-z]{20}$/);
    }
  });

  it('does not repeat', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(generateInboundToken());
    expect(seen.size).toBe(2000);
  });

  it('spreads across the alphabet rather than favouring part of it', () => {
    // A modulo bug or a truncated alphabet shows up as missing characters.
    const chars = new Set<string>();
    for (let i = 0; i < 500; i++) for (const c of generateInboundToken()) chars.add(c);
    expect(chars.size).toBe(32);
  });
});

describe('tokenFromAddress', () => {
  const token = 'abcdefghjkmnpqrstvwx';

  it('reads a bare address', () => {
    expect(tokenFromAddress(`${token}@${DOMAIN}`)).toBe(token);
  });

  it('reads one wrapped in a display name', () => {
    expect(tokenFromAddress(`TCA Imports <${token}@${DOMAIN}>`)).toBe(token);
  });

  it('is case-insensitive, because mail clients are', () => {
    expect(tokenFromAddress(`${token.toUpperCase()}@${DOMAIN.toUpperCase()}`)).toBe(token);
  });

  it('ignores a plus suffix', () => {
    // A sender adding +fall2026 must still reach the same school.
    expect(tokenFromAddress(`${token}+fall2026@${DOMAIN}`)).toBe(token);
  });

  it('REFUSES a lookalike domain', () => {
    // The whole scheme rests on this. A token is a bearer credential, so
    // accepting it at any domain but ours would let someone who saw the address
    // replay it from a host they control.
    expect(tokenFromAddress(`${token}@evil.com`)).toBeNull();
    expect(tokenFromAddress(`${token}@${DOMAIN}.evil.com`)).toBeNull();
    expect(tokenFromAddress(`${token}@not-${DOMAIN}`)).toBeNull();
  });

  it('is not fooled by the domain appearing earlier in the string', () => {
    // "…@in.athleticos.co@evil.com" is a single address at evil.com.
    expect(tokenFromAddress(`${token}@${DOMAIN}@evil.com`)).toBeNull();
  });

  it('refuses a local part that is not token-shaped', () => {
    expect(tokenFromAddress(`zephanie@${DOMAIN}`)).toBeNull(); // too short
    expect(tokenFromAddress(`imports@${DOMAIN}`)).toBeNull();
    expect(tokenFromAddress(`abcdefgi_jkmnpqrstvw@${DOMAIN}`)).toBeNull(); // underscore
    expect(tokenFromAddress(`abcdefgilmnpqrstvwxy@${DOMAIN}`)).toBeNull(); // i and l
  });

  it('refuses junk', () => {
    expect(tokenFromAddress('')).toBeNull();
    expect(tokenFromAddress('not-an-address')).toBeNull();
    expect(tokenFromAddress(`@${DOMAIN}`)).toBeNull();
  });

  it('round-trips what inboundAddress builds', () => {
    const fresh = generateInboundToken();
    expect(tokenFromAddress(inboundAddress(fresh))).toBe(fresh);
  });
});

describe('tokensFromRecipients', () => {
  const a = 'abcdefghjkmnpqrstvwx';
  const b = '0123456789abcdefghjk';

  it('finds the token when ours is one recipient among several', () => {
    // A Saved Action mails the AD, the trainer and us in one header.
    expect(
      tokensFromRecipients([`truman@trinitychristian.org, ${a}@${DOMAIN}, beck@trinitychristian.org`])
    ).toEqual([a]);
  });

  it('looks across every recipient header, not just To', () => {
    expect(tokensFromRecipients(['someone@elsewhere.org', `${a}@${DOMAIN}`])).toEqual([a]);
  });

  it('returns each token once', () => {
    expect(tokensFromRecipients([`${a}@${DOMAIN}`, `${a}@${DOMAIN}`])).toEqual([a]);
  });

  it('returns several when a message really does name two schools', () => {
    expect(new Set(tokensFromRecipients([`${a}@${DOMAIN}`, `${b}@${DOMAIN}`]))).toEqual(
      new Set([a, b])
    );
  });

  it('returns nothing for mail that names none of ours', () => {
    expect(tokensFromRecipients(['truman@trinitychristian.org'])).toEqual([]);
    expect(tokensFromRecipients([])).toEqual([]);
  });
});

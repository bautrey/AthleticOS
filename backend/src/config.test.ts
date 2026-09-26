// backend/src/config.test.ts
// Pure resolution logic, no database and no listener opened.

import { describe, it, expect, afterEach } from 'vitest';
import { config, resolveHost, isUsableWebhookSecret, decodedSecretBytes } from './config.js';

const originalHost = config.HOST;
const originalNodeEnv = config.NODE_ENV;

afterEach(() => {
  // config is a parsed singleton; these tests poke it directly rather than
  // re-importing the module under a mutated process.env.
  (config as { HOST: string }).HOST = originalHost;
  (config as { NODE_ENV: string }).NODE_ENV = originalNodeEnv;
});

describe('resolveHost', () => {
  it('binds loopback for local development', () => {
    (config as { NODE_ENV: string }).NODE_ENV = 'development';
    (config as { HOST: string }).HOST = '';
    expect(resolveHost({})).toBe('127.0.0.1');
  });

  it('binds loopback for tests', () => {
    (config as { NODE_ENV: string }).NODE_ENV = 'test';
    (config as { HOST: string }).HOST = '';
    expect(resolveHost({})).toBe('127.0.0.1');
  });

  it('binds every interface in production, where the router is outside the container', () => {
    (config as { NODE_ENV: string }).NODE_ENV = 'production';
    (config as { HOST: string }).HOST = '';
    expect(resolveHost({})).toBe('0.0.0.0');
  });

  it('binds every interface on Render even if NODE_ENV was never set', () => {
    // The schema defaults NODE_ENV to 'development', so without this a deploy that
    // forgot the variable would bind loopback and the service would be silently
    // unreachable while looking healthy.
    (config as { NODE_ENV: string }).NODE_ENV = 'development';
    (config as { HOST: string }).HOST = '';
    expect(resolveHost({ RENDER: 'true' })).toBe('0.0.0.0');
  });

  it('lets an explicit HOST win everywhere, which is how the tailnet gets bound', () => {
    (config as { HOST: string }).HOST = '100.105.170.105';

    (config as { NODE_ENV: string }).NODE_ENV = 'development';
    expect(resolveHost({})).toBe('100.105.170.105');

    (config as { NODE_ENV: string }).NODE_ENV = 'production';
    expect(resolveHost({})).toBe('100.105.170.105');

    expect(resolveHost({ RENDER: 'true' })).toBe('100.105.170.105');
  });

  it('lets Docker ask for every interface explicitly', () => {
    // compose sets HOST=0.0.0.0 because the published port cannot reach loopback
    // inside the container's network namespace.
    (config as { HOST: string }).HOST = '0.0.0.0';
    (config as { NODE_ENV: string }).NODE_ENV = 'development';
    expect(resolveHost({})).toBe('0.0.0.0');
  });

  it('never returns 0.0.0.0 for an ordinary local run', () => {
    (config as { HOST: string }).HOST = '';
    for (const nodeEnv of ['development', 'test'] as const) {
      (config as { NODE_ENV: string }).NODE_ENV = nodeEnv;
      expect(resolveHost({})).not.toBe('0.0.0.0');
    }
  });
});

describe('isUsableWebhookSecret', () => {
  // The inbound webhook's ONLY authentication is this secret. standardwebhooks
  // 1.0.0 checks `if (!secret)` before base64-decoding, so "whsec_" builds a
  // zero-byte HMAC key and then verifies any signature a stranger can compute.
  // The route's empty-string guard does not catch it, because "whsec_" is not
  // empty. Confirmed by running svix against the installed tree before writing
  // this, not inferred from the changelog.

  it('REFUSES a secret that decodes to nothing', () => {
    expect(isUsableWebhookSecret('whsec_')).toBe(false);
  });

  it('refuses a secret too short to be a real key', () => {
    // 8 bytes: enough to look like a secret, not enough to be one.
    expect(isUsableWebhookSecret('whsec_' + Buffer.alloc(8).toString('base64'))).toBe(false);
  });

  it('accepts a real Svix secret', () => {
    expect(
      isUsableWebhookSecret('whsec_' + Buffer.from('a'.repeat(32)).toString('base64'))
    ).toBe(true);
  });

  it('REFUSES a secret the verifier itself will not take', () => {
    // The trap this exists for: Buffer.from(x,'base64') is lenient and drops
    // characters it does not recognise, while standardwebhooks decodes
    // strictly. This value reports 16 bytes through Buffer and is rejected by
    // svix, so a length-only check passed it at boot and then every real
    // delivery 401'd with nothing said at startup. Measured, not assumed.
    const mangled = 'whsec_AAAAAAAAAAAAAAAAAAAAAA==AAAAAAAAAAAAAAAAAAAA';
    expect(decodedSecretBytes(mangled)).toBeGreaterThanOrEqual(16);
    expect(isUsableWebhookSecret(mangled)).toBe(false);
  });

  it('still accepts empty, which means inbound is simply not configured', () => {
    // The route answers 503 in that state rather than accepting unsigned
    // traffic, so a deployment without inbound configured must stay bootable.
    expect(isUsableWebhookSecret('')).toBe(true);
  });
});

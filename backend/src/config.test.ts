// backend/src/config.test.ts
// Pure resolution logic, no database and no listener opened.

import { describe, it, expect, afterEach } from 'vitest';
import { config, resolveHost } from './config.js';

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

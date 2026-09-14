// Test setup - uses a real database per the NO MOCKS policy.
//
// vitest.config.ts loads backend/.env into process.env before this runs, so
// DATABASE_URL and JWT_SECRET come from the developer's own file. This file
// supplies placeholders for the few settings that only gate code paths whose
// network calls the tests already stub.

// The live SKY client refuses to build a request without a subscription key
// (client.ts:151). client.test.ts stubs fetch and asserts the request shape, so
// it needs the key to be present, not to be real — and a real key must never be
// required to run the suite. A developer testing against live Blackbaud sets the
// genuine value in .env, which wins because vitest.config.ts does not overwrite
// an already-defined variable.
if (!process.env.BLACKBAUD_SUBSCRIPTION_KEY) {
  process.env.BLACKBAUD_SUBSCRIPTION_KEY = 'test-subscription-key-not-a-real-credential';
}

if (!process.env.BLACKBAUD_APP_SECRET) {
  process.env.BLACKBAUD_APP_SECRET = 'test-app-secret-not-a-real-credential';
}

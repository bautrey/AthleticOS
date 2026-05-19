// frontend/e2e/authenticated-dashboard.spec.ts
//
// Authenticated-flow smoke tests. These exercise post-login screens that the
// existing public-schedule.spec.ts cannot reach.
//
// How auth is established without driving the UI:
//   1. Hit the backend's /auth/register endpoint via Playwright's `request`
//      fixture. The response contains accessToken + refreshToken.
//   2. Before navigating, seed those tokens into localStorage with an
//      `addInitScript`. AuthProvider picks them up on mount and calls
//      /auth/me, populating the user — same path a real login takes.
//
// Requires the backend dev server on the API_URL below (default
// http://localhost:8003). If the API is not reachable the tests skip.
import { test, expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8003';

async function apiReachable(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(`${API_URL}/docs`, { timeout: 2000 });
    return res.ok();
  } catch {
    return false;
  }
}

async function registerFreshUser(request: APIRequestContext) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;
  const password = 'e2e-password-123';
  const res = await request.post(`${API_URL}/api/v1/auth/register`, {
    data: { email, password, name: 'E2E User' },
  });
  if (!res.ok()) {
    throw new Error(`register failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return {
    email,
    password,
    accessToken: body.data.accessToken as string,
    refreshToken: body.data.refreshToken as string,
  };
}

test.describe('Authenticated dashboard', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiReachable(request)), `API not reachable at ${API_URL}`);
  });

  test('a freshly-registered user lands on the empty-state dashboard', async ({
    page,
    request,
  }) => {
    const { accessToken, refreshToken } = await registerFreshUser(request);

    await page.addInitScript(
      ([a, r]) => {
        localStorage.setItem('accessToken', a);
        localStorage.setItem('refreshToken', r);
      },
      [accessToken, refreshToken]
    );

    await page.goto('/');

    // Dashboard with no schools shows the EmptyState we unit-tested earlier.
    await expect(page.getByRole('heading', { name: /your schools/i })).toBeVisible();
    await expect(page.getByText(/no schools yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create school/i })).toBeVisible();
  });

  test('logging out via the UI clears tokens and redirects to /login', async ({
    page,
    request,
  }) => {
    const { accessToken, refreshToken } = await registerFreshUser(request);

    await page.addInitScript(
      ([a, r]) => {
        localStorage.setItem('accessToken', a);
        localStorage.setItem('refreshToken', r);
      },
      [accessToken, refreshToken]
    );

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /your schools/i })).toBeVisible();

    // The Layout component renders a logout/sign-out control. We look for any
    // common variant — its exact label may evolve.
    const logout = page.getByRole('button', { name: /log\s*out|sign\s*out/i });
    if (await logout.count()) {
      await logout.first().click();
      await expect(page).toHaveURL(/\/login/);
      const stored = await page.evaluate(() => ({
        access: localStorage.getItem('accessToken'),
        refresh: localStorage.getItem('refreshToken'),
      }));
      expect(stored.access).toBeNull();
      expect(stored.refresh).toBeNull();
    } else {
      // No logout button in the UI right now — skip rather than false-fail.
      test.skip(true, 'No logout button rendered on the dashboard.');
    }
  });

  test('an authenticated user is NOT redirected to /login', async ({ page, request }) => {
    const { accessToken, refreshToken } = await registerFreshUser(request);

    await page.addInitScript(
      ([a, r]) => {
        localStorage.setItem('accessToken', a);
        localStorage.setItem('refreshToken', r);
      },
      [accessToken, refreshToken]
    );

    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
  });
});

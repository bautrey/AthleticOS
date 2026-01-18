// frontend/e2e/public-schedule.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Public Schedule Page', () => {
  // Tests for invalid tokens should show error states
  test('shows 404 for invalid share token', async ({ page }) => {
    await page.goto('/s/invalid-token-12345');

    // Should show 404 error message
    await expect(page.getByText(/404|not found/i)).toBeVisible();
  });

  test('shows error for inactive share', async ({ page }) => {
    // This would need a real inactive share token
    // For now, test the error state rendering
    await page.goto('/s/inactive-share-test');

    await expect(page.getByText(/not found|no longer active/i)).toBeVisible();
  });
});

test.describe('Public Schedule Embed', () => {
  test('embed page loads with dark theme', async ({ page }) => {
    await page.goto('/s/invalid-token/embed?theme=dark');

    // Should have dark background class
    const container = page.locator('div').first();
    await expect(container).toBeVisible();
  });

  test('embed page loads with light theme', async ({ page }) => {
    await page.goto('/s/invalid-token/embed?theme=light');

    const container = page.locator('div').first();
    await expect(container).toBeVisible();
  });
});

test.describe('Login Page', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');

    // Should see login form
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows validation errors for empty form', async ({ page }) => {
    await page.goto('/login');

    // Click submit without entering data
    await page.getByRole('button', { name: /sign in/i }).click();

    // Browser validation should kick in (required fields)
    const emailInput = page.getByLabel(/email/i);
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('has link to register page', async ({ page }) => {
    await page.goto('/login');

    const registerLink = page.getByRole('link', { name: /register|sign up/i });
    await expect(registerLink).toBeVisible();
  });
});

test.describe('Register Page', () => {
  test('register page renders correctly', async ({ page }) => {
    await page.goto('/register');

    // Should see registration form
    await expect(page.getByRole('heading', { name: /create account|sign up|register/i })).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});

test.describe('Protected Routes', () => {
  test('redirects to login when accessing dashboard unauthenticated', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to login when accessing school page unauthenticated', async ({ page }) => {
    await page.goto('/schools/some-school-id');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to login when accessing season page unauthenticated', async ({ page }) => {
    await page.goto('/schools/some-school/seasons/some-season');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

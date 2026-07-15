import { test, expect } from '@playwright/test';

// Smoke tests: verify that unauthenticated pages render and forms are wired.
// They deliberately avoid hitting the API — the point is to catch build /
// hydration / routing regressions quickly in CI.

test.describe('unauthenticated smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    // The marketing page should render *something* — either the marketing
    // landing content or a redirect to /login.
    await expect(page).toHaveURL(/\/(login)?$/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page renders form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });

  test('login validation rejects empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    // Either the browser-level 'required' tooltip prevents submission or the
    // form surfaces a validation message — both are acceptable, we just
    // shouldn't have navigated away.
    await expect(page).toHaveURL(/\/login/);
  });

  test('forgot password page is reachable', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('dashboard redirects unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

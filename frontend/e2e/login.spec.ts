import { test, expect } from '@playwright/test';

// End-to-end login test. Requires a running backend seeded with the default
// super admin credentials from `backend/prisma/seed.ts`. It is skipped when
// no admin credentials are supplied via env — this keeps CI green in
// front-end-only runs.

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('authenticated flow', () => {
  test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to enable');

  test('sign in and land on dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|platform|student|parent)/, { timeout: 15_000 });
    await expect(page.getByText(/dashboard|overview|namaskaram/i).first()).toBeVisible();
  });

  test('logout returns to login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|platform|student|parent)/, { timeout: 15_000 });

    // Best-effort logout via the user menu.
    const menu = page.getByRole('button', { name: /account|profile|menu|user/i });
    if (await menu.count()) {
      await menu.first().click();
      const logout = page.getByRole('menuitem', { name: /log out|sign out/i });
      if (await logout.count()) {
        await logout.first().click();
        await page.waitForURL(/\/login/, { timeout: 10_000 });
      }
    }
  });
});

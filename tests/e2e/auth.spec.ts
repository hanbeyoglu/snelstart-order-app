import { expect, test } from '@playwright/test';

test('unauthenticated users are redirected to login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('img', { name: /DHY Food BV/i })).toBeVisible();
  await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('failed login shows an error returned by the API', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  });

  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('sales@example.com');
  await page.locator('input[type="password"]').fill('wrong-password');
  await page.locator('button[type="submit"]').click();

  await expect(page.getByText('Unauthorized').first()).toBeVisible();
});

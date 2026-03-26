import { expect, test } from '@playwright/test';

test('login shell renders', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Welcome back')).toBeVisible();
  await expect(page.getByTestId('email-input')).toBeVisible();
  await expect(page.getByTestId('password-input')).toBeVisible();
  await expect(page.getByTestId('login-button')).toBeVisible();
});

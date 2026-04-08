import { expect, test } from '@playwright/test';
import { loginToApp } from './support/auth';

test('live account can sign in and reach the home shell', async ({ page }) => {
  await loginToApp(page);

  await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  await expect(page.getByText('Quick Access')).toBeVisible();
  await expect(page.getByTestId('quick-goals')).toBeVisible();
});

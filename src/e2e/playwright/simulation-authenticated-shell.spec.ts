import { expect, test } from '@playwright/test';
import { loginToApp } from './support/auth';

test('synthetic simulation stake leader can sign in and reach the authenticated companion shell', async ({ page }, testInfo) => {
  await loginToApp(page);

  await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  await expect(page.getByText('Quick Access')).toBeVisible();
  await expect(page.getByTestId('quick-goals')).toBeVisible();
  await expect(page.getByTestId('tab-more')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('simulation-authenticated-shell.png'),
    fullPage: true,
  });
});

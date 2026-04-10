import { expect, type Page } from '@playwright/test';
import { getLiveCredentials, type LiveTestAccount } from './live-credentials';

export async function loginToApp(page: Page, accountOverride?: LiveTestAccount) {
  const { email, password } = getLiveCredentials(accountOverride);

  await page.goto('/');

  await expect(page.getByText('Welcome back')).toBeVisible();
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-button').click();

  await Promise.race([
    page.getByText('Quick Access').waitFor({ state: 'visible' }),
    page.getByTestId('bishop-home-tab-screen').waitFor({ state: 'visible' }),
  ]);
}

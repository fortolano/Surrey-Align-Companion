import { expect, type Page } from '@playwright/test';
import { getLiveCredentials } from './live-credentials';

export async function loginToApp(page: Page) {
  const { email, password } = getLiveCredentials();

  await page.goto('/');

  await expect(page.getByText('Welcome back')).toBeVisible();
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-button').click();

  await expect(page.getByText('Quick Access')).toBeVisible();
}

import { expect, type Page } from '@playwright/test';

function readRequiredEnv(name: 'PWA_E2E_EMAIL' | 'PWA_E2E_PASSWORD'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Set PWA_E2E_EMAIL and PWA_E2E_PASSWORD before running authenticated Playwright tests.`);
  }

  return value;
}

export async function loginToApp(page: Page) {
  const email = readRequiredEnv('PWA_E2E_EMAIL');
  const password = readRequiredEnv('PWA_E2E_PASSWORD');

  await page.goto('/');

  await expect(page.getByText('Welcome back')).toBeVisible();
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-button').click();

  await expect(page.getByText('Quick Access')).toBeVisible();
}

import { expect, test } from '@playwright/test';
import { openMockedApp } from './support/mock-session';

const visibleCreateCallingButton = '[data-testid="create-calling-btn"]:visible';

async function openCallingCreate(page: Parameters<typeof openMockedApp>[0]) {
  await openMockedApp(page);
  await page.getByTestId('quick-callings').click();
  await expect(page).toHaveURL(/\/callings(?:\?|$)/);
  await page.locator(visibleCreateCallingButton).click();
  await expect(page).toHaveURL(/\/calling-create/);
  await expect(page.getByText('Request Details')).toBeVisible();
}

test.describe('calling create parity', () => {
  test('stake-wide requests can choose stake organizations and councils', async ({ page }) => {
    await openCallingCreate(page);

    await page.getByText('Select Level').click();
    await page.getByText('Stake').last().click();

    const proposedCallingInput = page.getByPlaceholder('Type a calling title', { exact: true });
    await proposedCallingInput.fill('Stake Assistant Executive Secretary');
    await page.locator('body').click();

    await expect(page.getByText('Organization or Council')).toBeVisible();
    await page.getByText('Select Organization or Council').last().click();

    await expect(page.getByText('High Council')).toBeVisible();
    await expect(page.getByText('Stake Presidency')).toBeVisible();
  });

  test('stake-reviewed ward callings reveal local-unit controls and limit assignments to the chosen ward', async ({ page }) => {
    await openCallingCreate(page);

    await page.getByText('Select Level').click();
    await page.getByText('Stake').last().click();

    const proposedCallingInput = page.getByPlaceholder('Type a calling title', { exact: true });
    await proposedCallingInput.fill('Bishopric First Counselor');
    await page.locator('body').click();

    await expect(page.getByText('This calling still belongs to a ward or branch even though the approval starts at the stake level.')).toBeVisible();

    await page.getByText('Select Type').last().click();
    await page.getByText('Ward').last().click();
    await page.getByText('Select Local Unit').last().click();
    await page.getByText('Cloverdale Ward').last().click();

    await page.getByText('Select Organization or Council').last().click();
    await expect(page.getByText('Cloverdale Bishopric')).toBeVisible();
    await expect(page.getByText('High Council')).toHaveCount(0);
  });

  test('branch requests show branch callings and branch organizations', async ({ page }) => {
    await openCallingCreate(page);

    await page.getByText('Select Level').last().click();
    await page.getByText('Local Unit').last().click();

    await page.getByText('Select Type').last().click();
    await page.getByText('Branch').last().click();
    await page.getByText('Select Local Unit').last().click();
    await page.getByText('Fleetwood Branch').last().click();

    const proposedCallingInput = page.getByPlaceholder('Type a calling title', { exact: true });
    await proposedCallingInput.fill('Branch Presidency First Counselor');
    await page.locator('body').click();

    await page.getByText('Select Organization or Council').last().click();
    await expect(page.getByText('Fleetwood Branch Presidency')).toBeVisible();
    await expect(page.getByText('Cloverdale Bishopric')).toHaveCount(0);
  });
});

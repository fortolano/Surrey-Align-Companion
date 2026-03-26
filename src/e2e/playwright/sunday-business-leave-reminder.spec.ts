import { expect, test, type Page } from '@playwright/test';
import { openMockedApp } from './support/mock-session';

const visibleRouteBackButton = '[data-testid="route-back-button"]:visible';

async function openSundayBusinessWithOutstandingWard(page: Page) {
  await openMockedApp(page);

  await page.getByTestId('quick-sunday-business').click();

  await expect(page).toHaveURL(/\/sunday-business(?:\?|$)/);
  await expect(page.getByText('Which ward are you attending this Sunday?')).toBeVisible();

  await page.getByTestId('sunday-ward-10').click();

  await expect(page.getByTestId('mark-all-conducted')).toBeVisible();
  await expect(page.getByText('Cloverdale Ward has 1 item to conduct')).toBeVisible();
}

test.describe('Sunday Business leave reminder', () => {
  test('footer tab exit shows reminder and Stay on Page keeps the user on Sunday Business', async ({ page }) => {
    await openSundayBusinessWithOutstandingWard(page);

    await page.getByTestId('tab-home').click();

    await expect(page.getByTestId('sunday-leave-reminder')).toBeVisible();
    await expect(page).toHaveURL(/\/sunday-business(?:\?|$)/);

    await page.getByTestId('sunday-leave-stay').click();

    await expect(page.getByTestId('sunday-leave-reminder')).toBeHidden();
    await expect(page).toHaveURL(/\/sunday-business(?:\?|$)/);
    await expect(page.getByTestId('mark-all-conducted')).toBeVisible();
  });

  test('header back exit shows reminder and Leave Anyway returns to Home', async ({ page }) => {
    await openSundayBusinessWithOutstandingWard(page);

    await page.locator(visibleRouteBackButton).click();

    await expect(page.getByTestId('sunday-leave-reminder')).toBeVisible();

    await page.getByTestId('sunday-leave-anyway').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Quick Access')).toBeVisible();
  });

  test('Mark All Now completes the business, exits, and prevents the reminder on the next leave', async ({ page }) => {
    await openSundayBusinessWithOutstandingWard(page);

    await page.getByTestId('tab-home').click();

    await expect(page.getByTestId('sunday-leave-reminder')).toBeVisible();

    await page.getByTestId('sunday-leave-mark-now').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Quick Access')).toBeVisible();

    await page.getByTestId('quick-sunday-business').click();

    await expect(page).toHaveURL(/\/sunday-business(?:\?|$)/);
    const allDoneMessage = page.getByText('All business conducted for Cloverdale Ward');
    const completedWardChip = page.getByTestId('sunday-completed-ward-10');

    if (!(await allDoneMessage.isVisible())) {
      await expect(completedWardChip).toBeVisible();
      await completedWardChip.click();
    }

    await expect(allDoneMessage).toBeVisible();

    await page.getByTestId('tab-home').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Quick Access')).toBeVisible();
  });
});

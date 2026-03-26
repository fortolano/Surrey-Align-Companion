import { expect, test } from '@playwright/test';
import { openMockedApp } from './support/mock-session';

const visibleRouteBackButton = '[data-testid="route-back-button"]:visible';
const visibleCreateCallingButton = '[data-testid="create-calling-btn"]:visible';
const visibleCallingCard = '[data-testid="calling-card-301"]:visible';
const visibleCallingDetailSundayBusinessLink = '[data-testid="calling-detail-sunday-business-link"]:visible';

test.describe('mobile route back navigation', () => {
  test.beforeEach(async ({ page }) => {
    await openMockedApp(page);
  });

  test('ALIGN Pulse opened from Home returns to Home', async ({ page }) => {
    await page.getByTestId('grid-pulse').click();

    await expect(page).toHaveURL(/\/align-pulse(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'ALIGN Pulse' })).toBeVisible();

    await page.locator(visibleRouteBackButton).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Quick Access')).toBeVisible();
  });

  test('Settings opened from Home avatar menu returns to Home', async ({ page }) => {
    await page.getByTestId('avatar-menu-btn').click();
    await page.getByText('Settings').click();

    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    await expect(page.getByText('Settings')).toBeVisible();

    await page.locator(visibleRouteBackButton).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Quick Access')).toBeVisible();
  });

  test('About this App opened from More returns to More', async ({ page }) => {
    await page.getByTestId('tab-more').click();

    await expect(page).toHaveURL(/\/more(?:\?|$)/);
    await expect(page.getByText('Update App Now')).toBeVisible();

    await page.getByText('About this App').click();

    await expect(page).toHaveURL(/\/about-app(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'About this App' })).toBeVisible();

    await page.locator(visibleRouteBackButton).click();

    await expect(page).toHaveURL(/\/more$/);
    await expect(page.getByText('Update App Now')).toBeVisible();
  });

  test('Calling detail opened from Notifications returns to Notifications', async ({ page }) => {
    await page.getByTestId('tab-notifications').click();

    await expect(page).toHaveURL(/\/notifications(?:\?|$)/);
    await expect(page.getByText('Stay up to date')).toBeVisible();

    await page.getByTestId('notification-row-9101').click();

    await expect(page).toHaveURL(/\/calling-detail/);
    await expect(page.locator(visibleCallingDetailSundayBusinessLink)).toBeVisible();

    await page.locator(visibleRouteBackButton).click();

    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByText('Stay up to date')).toBeVisible();
  });

  test('Callings detail and nested Sunday Business return to the right parent screens', async ({ page }) => {
    await page.getByTestId('quick-callings').click();

    await expect(page).toHaveURL(/\/callings(?:\?|$)/);
    await expect(page.locator(visibleCallingCard)).toBeVisible();

    await page.locator(visibleCallingCard).click();

    await expect(page).toHaveURL(/\/calling-detail/);
    await expect(page.locator(visibleCallingDetailSundayBusinessLink)).toBeVisible();

    await page.locator(visibleCallingDetailSundayBusinessLink).click();

    await expect(page).toHaveURL(/\/sunday-business/);
    await expect(page.getByText('Which ward are you attending this Sunday?')).toBeVisible();

    await page.locator(visibleRouteBackButton).click();

    await expect(page).toHaveURL(/\/calling-detail/);
    await expect(page.locator(visibleCallingDetailSundayBusinessLink)).toBeVisible();

    await page.locator(visibleRouteBackButton).click();

    await expect(page).toHaveURL(/\/callings(?:\?|$)/);
    await expect(page.locator(visibleCallingCard)).toBeVisible();
  });

  test('New calling request opened from Callings returns to Callings on cancel', async ({ page }) => {
    await page.getByTestId('quick-callings').click();

    await expect(page).toHaveURL(/\/callings(?:\?|$)/);
    await expect(page.locator(visibleCallingCard)).toBeVisible();

    await page.locator(visibleCreateCallingButton).click();

    await expect(page).toHaveURL(/\/calling-create/);
    await expect(page.getByText('Request Details')).toBeVisible();

    await page.getByTestId('calling-create-cancel').click();

    await expect(page).toHaveURL(/\/callings(?:\?|$)/);
    await expect(page.locator(visibleCallingCard)).toBeVisible();
  });

  test('New calling request opened from Add returns to Add on cancel', async ({ page }) => {
    await page.getByTestId('tab-add').click();

    await expect(page).toHaveURL(/\/add(?:\?|$)/);
    await expect(page.getByText('What would you like to add?')).toBeVisible();

    await page.getByTestId('add-calling-request').click();

    await expect(page).toHaveURL(/\/calling-create/);
    await expect(page.getByText('Request Details')).toBeVisible();

    await page.getByTestId('calling-create-cancel').click();

    await expect(page).toHaveURL(/\/add(?:\?|$)/);
    await expect(page.getByText('What would you like to add?')).toBeVisible();
  });
});

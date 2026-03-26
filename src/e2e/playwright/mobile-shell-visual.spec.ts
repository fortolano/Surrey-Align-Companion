import { expect, test, type Page } from '@playwright/test';
import { openMockedApp } from './support/mock-session';

const VISUAL_STYLES = `
  *, *::before, *::after {
    caret-color: transparent !important;
    transition-duration: 0s !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }

  [data-testid="global-refresh-indicator"] {
    display: none !important;
  }
`;

const visibleCallingCard = '[data-testid="calling-card-301"]:visible';

async function stabilizeVisualPage(page: Page, settleMs = 350) {
  await page.addStyleTag({ content: VISUAL_STYLES });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(settleMs);
}

async function expectShellScreenshot(page: Page, name: string, settleMs?: number) {
  await stabilizeVisualPage(page, settleMs);
  await expect(page).toHaveScreenshot(name);
}

test.describe('mobile shell visual snapshots', () => {
  test.beforeEach(async ({ page }) => {
    await openMockedApp(page);
  });

  test('home shell stays visually stable', async ({ page }) => {
    await expect(page.getByText('Quick Access')).toBeVisible();
    await expectShellScreenshot(page, 'home-shell.png');
  });

  test('more shell stays visually stable', async ({ page }) => {
    await page.goto('/more');

    await expect(page).toHaveURL(/\/more(?:\?|$)/);
    await expect(page.getByText('Update App Now')).toBeVisible();

    await expectShellScreenshot(page, 'more-shell.png');
  });

  test('callings route shell stays visually stable', async ({ page }) => {
    await page.goto('/callings');

    await expect(page).toHaveURL(/\/callings(?:\?|$)/);
    await expect(page.locator(visibleCallingCard)).toBeVisible();

    await expectShellScreenshot(page, 'callings-shell.png');
  });

  test('Sunday Business shell stays visually stable', async ({ page }) => {
    await page.goto('/sunday-business');

    await expect(page).toHaveURL(/\/sunday-business(?:\?|$)/);
    await expect(page.getByText('Which ward are you attending this Sunday?')).toBeVisible();

    await expectShellScreenshot(page, 'sunday-business-shell.png');
  });

  test('ALIGN Pulse pushed route shell stays visually stable', async ({ page }) => {
    await page.goto('/align-pulse');

    await expect(page).toHaveURL(/\/align-pulse(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'ALIGN Pulse' })).toBeVisible();

    await expectShellScreenshot(page, 'align-pulse-shell.png', 900);
  });
});

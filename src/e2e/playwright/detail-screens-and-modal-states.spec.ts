import { expect, test, type Page } from '@playwright/test';
import { openMockedRoute } from './support/mock-session';

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

async function stabilizeVisualPage(page: Page, settleMs = 400) {
  await page.addStyleTag({ content: VISUAL_STYLES });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(settleMs);
}

async function expectScreenScreenshot(page: Page, name: string, settleMs?: number) {
  await stabilizeVisualPage(page, settleMs);
  await expect(page).toHaveScreenshot(name);
}

test.describe('detail screens and modal states', () => {
  test('Settings route shell stays visually stable', async ({ page }) => {
    await openMockedRoute(page, '/settings');

    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    await expect(page.getByText('What notifications do you want to receive?')).toBeVisible();

    await expectScreenScreenshot(page, 'settings-shell.png', 650);
  });

  test('Calling Detail route shell stays visually stable', async ({ page }) => {
    await openMockedRoute(page, '/calling-detail?id=301&returnTo=%2Fnotifications');

    await expect(page).toHaveURL(/\/calling-detail(?:\?|$)/);
    await expect(page.getByText('Ward Choir Director')).toBeVisible();
    await expect(page.getByTestId('calling-detail-sunday-business-link')).toBeVisible();

    await expectScreenScreenshot(page, 'calling-detail-shell.png', 900);
  });

  test('Notifications mark all read clears unread state and the unread filter becomes empty', async ({ page }) => {
    await openMockedRoute(page, '/notifications');
    await expect(page).toHaveURL(/\/notifications(?:\?|$)/);
    await expect(page.getByText('Your action inbox')).toBeVisible();

    await page.evaluate(async () => {
      await fetch('/api/notifications/9102/unread', { method: 'POST' });
    });
    await page.reload();

    await expect(page).toHaveURL(/\/notifications(?:\?|$)/);
    await expect(page.getByText('1 update still needs your attention')).toBeVisible();
    await expect(page.getByTestId('mark-all-read')).toBeVisible();

    await page.getByTestId('mark-all-read').click();

    await expect(page.getByTestId('filter-unread')).toContainText('Unread (0)');
    await expect(page.getByTestId('mark-all-read')).toBeHidden();

    await page.getByTestId('filter-unread').click();

    await expect(page.getByText('No unread updates')).toBeVisible();
    await expect(page.getByText("You're caught up for now.")).toBeVisible();
  });

  test('Settings email frequency changes persist after a reload', async ({ page }) => {
    await openMockedRoute(page, '/settings');

    const weeklySegment = page.getByTestId('settings-email-frequency-weekly');

    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    await expect(page.getByText('How often should we email you?')).toBeVisible();

    await weeklySegment.click();
    await expect(weeklySegment).toHaveCSS('background-color', 'rgb(238, 248, 252)');
    await expect(weeklySegment).toHaveCSS('border-color', 'rgb(1, 97, 131)');

    await page.reload();

    await expect(page.getByText('How often should we email you?')).toBeVisible();
    await expect(page.getByTestId('settings-email-frequency-weekly')).toHaveCSS('background-color', 'rgb(238, 248, 252)');
    await expect(page.getByTestId('settings-email-frequency-weekly')).toHaveCSS('border-color', 'rgb(1, 97, 131)');
  });

  test('Notifications shell stays visually stable', async ({ page }) => {
    await openMockedRoute(page, '/notifications');

    await expect(page).toHaveURL(/\/notifications(?:\?|$)/);
    await expect(page.getByText('Your action inbox')).toBeVisible();

    await expectScreenScreenshot(page, 'notifications-shell.png', 650);
  });
});

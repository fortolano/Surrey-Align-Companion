import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { loginToApp } from './support/auth';
import { getLiveCredentials } from './support/live-credentials';

interface AgendaEntityCandidate {
  entity_type: string;
  entity_id: number;
  entity_name: string;
  current_agenda_id?: number | null;
  current_agenda_title?: string | null;
  latest_past_agenda_id?: number | null;
}

interface AgendaNotificationScenario {
  notificationId: number;
  expectedAgendaText: string;
}

interface PulseReportScenario {
  hasAnySubmissions: boolean;
  hasSupportRequests: boolean;
  monthLabel: string;
}

async function loginViaApi(request: APIRequestContext) {
  const { email, password } = getLiveCredentials();

  const response = await request.post('/api/auth/login', {
    data: { email, password },
  });

  expect(response.ok()).toBeTruthy();

  const data = await response.json();

  expect(data.success).toBeTruthy();

  return data.token as string;
}

async function authGet(request: APIRequestContext, token: string, path: string) {
  return request.get(path, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
}

async function dismissInstallPromptIfPresent(page: Page) {
  const gotItButton = page.getByRole('button', { name: 'Got It' });

  if (await gotItButton.isVisible().catch(() => false)) {
    await gotItButton.click();
  }
}

async function findAgendaReviewEntity(request: APIRequestContext) {
  const token = await loginViaApi(request);
  const response = await authGet(request, token, '/api/agendas/entities');

  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  const entities = (data.entities ?? []) as AgendaEntityCandidate[];
  const entity = entities.find((candidate) => candidate.current_agenda_id)
    ?? entities.find((candidate) => candidate.latest_past_agenda_id);

  if (!entity) {
    throw new Error('No accessible simulation agenda entity with current or past agenda state was found for the PWA ward profile.');
  }

  return entity;
}

async function findAgendaNotificationScenario(request: APIRequestContext): Promise<AgendaNotificationScenario> {
  const token = await loginViaApi(request);
  const notificationResponse = await authGet(request, token, '/api/notifications');

  expect(notificationResponse.ok()).toBeTruthy();

  const notificationData = await notificationResponse.json();
  const notification = (notificationData.notifications ?? []).find(
    (candidate: any) => {
      const actionName = candidate?.app_action?.name;

      return actionName === 'agenda.item_detail' || actionName === 'agenda.detail';
    },
  );

  if (!notification?.id) {
    throw new Error('No simulation notification currently routes into agenda review for the ward mobile profile.');
  }

  return {
    notificationId: Number(notification.id),
    expectedAgendaText: String(notification.title ?? '')
      .replace(/^Follow-through recorded:\s*/i, '')
      .trim(),
  };
}

async function findPulseReportScenario(request: APIRequestContext): Promise<PulseReportScenario> {
  const token = await loginViaApi(request);
  const reportResponse = await authGet(request, token, '/api/reports/align-pulse');

  expect(reportResponse.ok()).toBeTruthy();

  const reportData = await reportResponse.json();

  return {
    hasAnySubmissions: Number(reportData.submission_rate ?? 0) > 0,
    hasSupportRequests: Array.isArray(reportData.support_requests) && reportData.support_requests.length > 0,
    monthLabel: String(reportData.month_label ?? ''),
  };
}

test('simulation-backed ward leader can open agenda review from More on the month-one companion backend', async ({ page, request }, testInfo) => {
  const entity = await findAgendaReviewEntity(request);

  await loginToApp(page);
  await page.goto('/more');

  await expect(page.getByTestId(`more-item-agenda-${entity.entity_type}-${entity.entity_id}`)).toBeVisible();
  await page.getByTestId(`more-item-agenda-${entity.entity_type}-${entity.entity_id}`).click();

  await expect(page).toHaveURL(/\/agenda-entity(?:\?|$)/);
  await expect(page.locator('body')).toContainText(entity.entity_name);

  if (entity.current_agenda_title) {
    await expect(page.locator('body')).toContainText(entity.current_agenda_title);
  } else {
    await expect(page.getByTestId('agenda-tab-past')).toBeVisible();
  }

  await page.screenshot({
    path: testInfo.outputPath('simulation-agenda-review.png'),
    fullPage: true,
  });
});

test('simulation-backed ward leader can route from notification inbox into agenda review on the month-one companion backend', async ({ page, request }, testInfo) => {
  const scenario = await findAgendaNotificationScenario(request);

  await loginToApp(page);
  await page.goto('/notifications');

  await expect(page.getByText('Your action inbox')).toBeVisible();
  await expect(page.getByTestId(`notification-row-${scenario.notificationId}`)).toBeVisible();
  await page.getByTestId(`notification-row-${scenario.notificationId}`).click();

  await expect(page).toHaveURL(/\/agenda-entity(?:\?|$)/);

  if (scenario.expectedAgendaText !== '') {
    await expect(page.locator('body')).toContainText(scenario.expectedAgendaText);
  }

  await dismissInstallPromptIfPresent(page);

  await page.screenshot({
    path: testInfo.outputPath('simulation-notification-to-agenda.png'),
    fullPage: true,
  });
});

test('simulation-backed ward leader can open ALIGN Pulse from More on the month-one companion backend', async ({ page, request }, testInfo) => {
  const scenario = await findPulseReportScenario(request);

  await loginToApp(page);
  await page.goto('/more');

  await expect(page.getByTestId('more-item-pulse')).toBeVisible();
  await page.getByTestId('more-item-pulse').click();

  await expect(page).toHaveURL(/\/align-pulse(?:\?|$)/);
  await expect(page.getByRole('heading', { name: 'ALIGN Pulse' })).toBeVisible();

  if (scenario.monthLabel !== '') {
    await expect(page.locator('body')).toContainText(scenario.monthLabel);
  }

  if (scenario.hasSupportRequests) {
    await expect(page.locator('body')).toContainText('Support Requests');
  } else if (scenario.hasAnySubmissions) {
    await expect(page.locator('body')).toContainText('Submitted');
  } else {
    await expect(page.locator('body')).toContainText('No pulses yet');
  }

  await dismissInstallPromptIfPresent(page);

  await page.screenshot({
    path: testInfo.outputPath('simulation-align-pulse.png'),
    fullPage: true,
  });
});

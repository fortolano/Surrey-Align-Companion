import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { loginToApp } from './support/auth';

interface PlannerMeeting {
  id: number | null;
  meeting_date: string;
  meeting_date_label: string;
  announcement_count: number;
}

interface AnnouncementResponse {
  success: boolean;
  meeting: {
    id: number;
    announcement_review: {
      reviewed_at: string | null;
      can_mark_reviewed: boolean;
    };
  } | null;
  announcements: Array<{ id: number; title: string }>;
}

interface SpeakerFollowUpResponse {
  success: boolean;
  meeting: {
    id: number;
    speaker_follow_up: {
      allowed: boolean;
      blocked_reason: string | null;
    };
  };
  follow_up: Array<{
    id: number;
    delivery: {
      state: string;
    };
    follow_up_action: {
      allowed: boolean;
      mode: string | null;
      label: string | null;
    };
  }>;
}

interface SacramentOverviewScenario {
  meetingId: number;
  meetingDate: string;
  meetingDateLabel: string;
  invitationId: number;
  invitationActionLabel: string;
}

test.describe.configure({ mode: 'serial' });

async function loginViaApi(request: APIRequestContext) {
  const email = process.env.PWA_E2E_EMAIL?.trim() || 'ward-a.bishop@example.test';
  const password = process.env.PWA_E2E_PASSWORD?.trim() || 'password';

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

async function getStoredAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    const directToken = window.localStorage.getItem('sa_token');

    if (directToken && directToken.trim() !== '') {
      return directToken;
    }

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (!key || !key.includes('sa_token')) {
        continue;
      }

      const value = window.localStorage.getItem(key);

      if (value && value.trim() !== '') {
        return value;
      }
    }

    return null;
  });

  if (!token) {
    throw new Error('No stored PWA auth token was available after login.');
  }

  return token;
}

async function clickAndAcceptDialog(page: Page, locator: Locator, expectedText: string) {
  const dialogPromise = page.waitForEvent('dialog');

  await locator.click();

  const dialog = await dialogPromise;

  expect(dialog.message()).toContain(expectedText);
  await dialog.accept();
}

async function findSacramentOverviewScenario(request: APIRequestContext): Promise<SacramentOverviewScenario> {
  const token = await loginViaApi(request);
  const overviewResponse = await authGet(request, token, '/api/sacrament-planner/overview?weeks=8');

  expect(overviewResponse.ok()).toBeTruthy();

  const overviewData = await overviewResponse.json();
  const meetings = (overviewData.meetings ?? []) as PlannerMeeting[];
  const meeting = meetings.find((candidate) => candidate.id && candidate.announcement_count > 0);

  if (!meeting?.id) {
    throw new Error('No actionable current-window sacrament meeting was available for the ward mobile profile.');
  }

  const announcementResponse = await authGet(
    request,
    token,
    `/api/announcements/active?meeting_date=${meeting.meeting_date}`,
  );

  expect(announcementResponse.ok()).toBeTruthy();

  const announcementData = await announcementResponse.json() as AnnouncementResponse;

  if (!announcementData.meeting?.announcement_review.can_mark_reviewed || announcementData.announcements.length === 0) {
    throw new Error('The current-window sacrament meeting did not expose a bishopric announcement-review action.');
  }

  const speakerFollowUpResponse = await authGet(
    request,
    token,
    `/api/sacrament-planner/${meeting.id}/speaker-follow-up`,
  );

  expect(speakerFollowUpResponse.ok()).toBeTruthy();

  const speakerFollowUpData = await speakerFollowUpResponse.json() as SpeakerFollowUpResponse;
  const invitation = speakerFollowUpData.follow_up.find(
    (candidate) => candidate.follow_up_action.allowed && candidate.follow_up_action.mode === 'manual_contact_reminder',
  ) ?? speakerFollowUpData.follow_up.find((candidate) => candidate.follow_up_action.allowed);

  if (!speakerFollowUpData.meeting.speaker_follow_up.allowed || !invitation?.id || !invitation.follow_up_action.label) {
    throw new Error('The current-window sacrament meeting did not expose an allowed bishopric speaker follow-up action.');
  }

  return {
    meetingId: meeting.id,
    meetingDate: meeting.meeting_date,
    meetingDateLabel: meeting.meeting_date_label,
    invitationId: invitation.id,
    invitationActionLabel: invitation.follow_up_action.label,
  };
}

test('simulation-backed ward leader can open Sacrament Overview from More on the same simulation backend', async ({ page }, testInfo) => {
  await loginToApp(page);
  await page.goto('/more');

  await expect(page.getByTestId('more-item-sacrament-overview')).toBeVisible();
  await page.getByTestId('more-item-sacrament-overview').click();

  await expect(page).toHaveURL(/\/sacrament-overview(?:\?|$)/);
  await expect(page.getByRole('heading', { name: 'Sacrament Overview' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Upcoming Sundays');

  await dismissInstallPromptIfPresent(page);

  await page.screenshot({
    path: testInfo.outputPath('simulation-sacrament-overview.png'),
    fullPage: true,
  });
});

test('simulation-backed ward leader can mark the current Sunday announcement queue reviewed', async ({ page, request }, testInfo) => {
  const scenario = await findSacramentOverviewScenario(request);

  await loginToApp(page);
  await page.goto(`/sacrament-overview?weeks=8&meetingDate=${scenario.meetingDate}`);
  await dismissInstallPromptIfPresent(page);

  await expect(page.getByRole('heading', { name: 'Sacrament Overview' })).toBeVisible();
  await expect(page.locator('body')).toContainText(scenario.meetingDateLabel);
  await expect(page.getByTestId('sacrament-announcement-review-button')).toBeVisible();

  const verificationToken = await getStoredAuthToken(page);

  await clickAndAcceptDialog(
    page,
    page.getByTestId('sacrament-announcement-review-button'),
    'Announcements reviewed',
  );

  await expect.poll(async () => {
    const verificationResponse = await authGet(
      request,
      verificationToken,
      `/api/announcements/active?meeting_date=${scenario.meetingDate}`,
    );
    const verificationData = await verificationResponse.json() as AnnouncementResponse;

    return verificationData.meeting?.announcement_review.reviewed_at ?? null;
  }).not.toBeNull();

  await page.screenshot({
    path: testInfo.outputPath('simulation-sacrament-announcement-reviewed.png'),
    fullPage: true,
  });
});

test('simulation-backed ward leader can record an allowed bishopric speaker follow-up reminder', async ({ page, request }, testInfo) => {
  const scenario = await findSacramentOverviewScenario(request);

  await loginToApp(page);
  await page.goto(`/sacrament-overview?weeks=8&meetingDate=${scenario.meetingDate}`);
  await dismissInstallPromptIfPresent(page);

  await expect(page.getByRole('heading', { name: 'Sacrament Overview' })).toBeVisible();
  await expect(page.getByTestId(`sacrament-speaker-follow-up-${scenario.invitationId}`)).toBeVisible();
  await expect(page.getByTestId(`sacrament-speaker-follow-up-${scenario.invitationId}`)).toContainText(scenario.invitationActionLabel);

  const verificationToken = await getStoredAuthToken(page);

  await clickAndAcceptDialog(
    page,
    page.getByTestId(`sacrament-speaker-follow-up-${scenario.invitationId}`),
    'Speaker follow-up updated',
  );

  await expect.poll(async () => {
    const verificationResponse = await authGet(
      request,
      verificationToken,
      `/api/sacrament-planner/${scenario.meetingId}/speaker-follow-up`,
    );
    const verificationData = await verificationResponse.json() as SpeakerFollowUpResponse;
    const invitation = verificationData.follow_up.find((candidate) => candidate.id === scenario.invitationId);

    return invitation?.delivery.state ?? 'missing';
  }).toBe('manual_contact_recorded');

  await page.screenshot({
    path: testInfo.outputPath('simulation-sacrament-speaker-follow-up.png'),
    fullPage: true,
  });
});

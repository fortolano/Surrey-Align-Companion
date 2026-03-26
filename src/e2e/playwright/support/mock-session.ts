import { expect, type Page, type Route } from '@playwright/test';

const MOCK_TOKEN = 'playwright-mock-token';
const FIXED_NOW_ISO = '2026-03-23T18:00:00.000Z';

const MOCK_USER = {
  id: 42,
  name: 'Playwright High Councilor',
  email: 'playwright.high.councilor@example.com',
  phone: null,
  calling: 'High Councilor',
  ward: 'Cloverdale Ward',
  ward_id: 10,
  stake: 'Surrey Stake',
  stake_id: 1,
  is_stake_admin: false,
  is_stake_president: false,
  is_stake_presidency_member: false,
  is_stake_council_member: false,
  is_high_councilor: true,
  is_bishop: false,
  is_bishopric_member: false,
  is_ward_org_president: false,
  is_ward_org_presidency_member: false,
  is_stake_org_president: false,
  is_stake_org_presidency_member: false,
  is_stake_director: false,
  is_executive_secretary: false,
  is_active: true,
};

const CALLING_REQUEST_ID = 301;
const PRIMARY_WARD_ID = 10;
const COMPLETED_WARD_ID = 11;

const CALLING_LIST_RESPONSE = {
  calling_requests: [
    {
      id: CALLING_REQUEST_ID,
      request_type: 'calling',
      request_type_label: 'Calling',
      scope: 'ward',
      status: 'discussion',
      status_label: 'Under Consideration',
      target_calling: 'Ward Choir Director',
      target_ward: 'Cloverdale Ward',
      target_organization: 'Ward Music',
      approval_authority: 'bishopric',
      approval_authority_label: 'Bishopric',
      submitted_by: 'Bishopric Counselor',
      submitted_at: '2026-03-20T18:00:00Z',
      individuals: [
        {
          id: 1,
          name: 'Jane Doe',
          is_selected: true,
        },
      ],
      selected_individual: 'Jane Doe',
      steps_progress: 50,
      updated_at: '2026-03-22T15:00:00Z',
    },
  ],
};

const CALLING_DETAIL_RESPONSE = {
  calling_request: {
    id: CALLING_REQUEST_ID,
    request_type: 'calling',
    request_type_label: 'Calling',
    scope: 'ward',
    status: 'discussion',
    status_label: 'Under Consideration',
    target_calling: {
      id: 501,
      name: 'Ward Choir Director',
    },
    target_ward: {
      id: PRIMARY_WARD_ID,
      name: 'Cloverdale Ward',
    },
    target_organization: {
      id: 700,
      name: 'Ward Music',
    },
    approval_authority: 'bishopric',
    approval_authority_label: 'Bishopric',
    individuals: [
      {
        id: 1,
        name: 'Jane Doe',
        is_selected: true,
        recommendation: 'Strong musical leadership and dependable follow-through.',
        requires_release_from_current: false,
      },
    ],
    current_holder: null,
    context_notes: 'Needs support for the spring ward choir schedule.',
    timeline: [],
    steps_progress: 50,
    steps: [],
    comments: [],
    feedback_requests: [],
    vote_tally: {
      approve: 0,
      disapprove: 0,
      total_voters: 0,
    },
    votes: [],
    pending_voters: [],
    sunday_business_gate: {
      active: true,
      total_items: 1,
      completed_items: 0,
      message: 'Sunday business still needs to be conducted before this request can move forward.',
    },
    submitted_by: {
      name: 'Bishopric Counselor',
    },
    submitted_at: '2026-03-20T18:00:00Z',
  },
  permissions: {
    can_move_to_discussion: false,
    can_move_to_voting: false,
    can_complete: false,
    can_cancel: false,
    can_manage_steps: false,
    can_vote: false,
    can_decide: false,
    can_manage: false,
    can_select_individual: false,
  },
  next_action: {
    type: 'waiting_sunday_business',
    heading: 'Conduct Sunday Business',
    description: 'This request is waiting for Sunday business to be conducted.',
    context: 'Cloverdale Ward',
    style: 'info',
    is_terminal: false,
    is_waiting: true,
  },
  view_level: 'full',
  is_requestor_only: false,
};

const SUNDAY_BUSINESS_RESPONSE = {
  success: true,
  user_context: {
    role: 'high_councilor',
    label: 'High Councilor',
    can_manage_queue: true,
    sees_stake_business: false,
    sees_ward_business: true,
    ward_ids: null,
  },
  wards: [
    { id: PRIMARY_WARD_ID, name: 'Cloverdale Ward' },
    { id: COMPLETED_WARD_ID, name: 'Fleetwood Ward' },
  ],
  business_items: [
    {
      id: 401,
      bundle_id: 'bundle-release-1',
      scope: 'ward',
      item_type: 'release',
      item_type_label: 'Release',
      person_name: 'Jane Doe',
      calling_name: 'Ward Choir Director',
      organization_name: 'Ward Music',
      person_ward: { id: PRIMARY_WARD_ID, name: 'Cloverdale Ward' },
      target_ward: { id: PRIMARY_WARD_ID, name: 'Cloverdale Ward' },
      script_text:
        'Jane Doe has been released as Ward Choir Director. Those who wish to express thanks may do so by the uplifted hand.',
      released_at: '2026-03-21T18:00:00Z',
      created_at: '2026-03-21T18:00:00Z',
      wards_required: [PRIMARY_WARD_ID],
      wards_completed: [],
      wards_outstanding: [PRIMARY_WARD_ID],
      ward_names: {
        [String(PRIMARY_WARD_ID)]: 'Cloverdale Ward',
      },
      completion_progress: 0,
    },
    {
      id: 402,
      bundle_id: 'bundle-sustain-2',
      scope: 'ward',
      item_type: 'sustaining',
      item_type_label: 'Sustaining',
      person_name: 'John Doe',
      calling_name: 'Ward Music Chair',
      organization_name: 'Ward Music',
      person_ward: { id: COMPLETED_WARD_ID, name: 'Fleetwood Ward' },
      target_ward: { id: COMPLETED_WARD_ID, name: 'Fleetwood Ward' },
      script_text:
        'John Doe has been called as Ward Music Chair. Those in favor may manifest it.',
      released_at: '2026-03-20T18:00:00Z',
      created_at: '2026-03-20T18:00:00Z',
      wards_required: [COMPLETED_WARD_ID],
      wards_completed: [COMPLETED_WARD_ID],
      wards_outstanding: [],
      ward_names: {
        [String(COMPLETED_WARD_ID)]: 'Fleetwood Ward',
      },
      completion_progress: 100,
    },
  ],
};

const NOTIFICATIONS_RESPONSE = {
  notifications: [
    {
      id: 9101,
      type: 'status_changed',
      title: 'Ward Choir Director updated',
      message: 'Open the request details to review Sunday business progress.',
      is_read: true,
      created_at: '2026-03-22T16:30:00Z',
      data: {
        calling_request_id: CALLING_REQUEST_ID,
      },
    },
    {
      id: 9102,
      type: 'reminder',
      title: 'Review your notifications',
      message: 'Use the mobile app to stay current on calling updates.',
      is_read: true,
      created_at: '2026-03-21T12:00:00Z',
      data: {},
    },
  ],
  meta: {
    total: 2,
    unread_count: 0,
  },
};

const SETTINGS_RESPONSE = {
  success: true,
  notifications_enabled: true,
  preferences: {
    muted_notification_categories: [],
    email_notification_frequency: 'daily',
  },
  options: {
    categories: [
      {
        key: 'decisions',
        label: 'Decisions',
        description: 'Decisions and outcomes on your calling requests.',
      },
      {
        key: 'updates',
        label: 'Updates',
        description: 'Status changes and important updates.',
      },
    ],
    email_frequencies: [
      { key: 'daily', label: 'Daily' },
      { key: 'weekly', label: 'Weekly' },
      { key: 'none', label: 'None' },
    ],
  },
};

const PULSE_REPORT_RESPONSE = {
  success: true,
  month_label: 'March 2026',
  date_label: 'March 2026',
  cycle_id: 1,
  check_in_month: 3,
  check_in_year: 2026,
  submission_rate: 82,
  confidence_distribution: {
    high: 8,
    medium: 3,
    low: 1,
  },
  trend: {
    prev_month_label: 'February 2026',
    has_previous_data: true,
    high_delta: 1,
    medium_delta: -1,
    low_delta: 0,
    prev_high: 7,
    prev_medium: 4,
    prev_low: 1,
  },
  needs_attention: [
    {
      goal_id: 1,
      goal_title: 'Strengthen Sunday worship participation',
      confidence: 'medium',
      organization: 'Ward Music',
      organization_id: 700,
      council: null,
      council_id: null,
      user_name: 'Jane Doe',
      support_types: ['Coaching'],
      support_note: 'Needs one more accompanist.',
      stuck_months: 2,
      health: {
        overall_score: 72,
        overall_color: 'warning',
        letters: [
          { letter: 'P', score: 80, color: 'success' },
          { letter: 'A', score: 68, color: 'warning' },
        ],
      },
      confidence_history: [
        { month: 2, year: 2026, confidence: 'medium', month_label: 'Feb' },
        { month: 3, year: 2026, confidence: 'medium', month_label: 'Mar' },
      ],
    },
  ],
  by_ward: [
    {
      ward_name: 'Cloverdale Ward',
      goal_count: 4,
      high: 3,
      medium: 1,
      low: 0,
      support_count: 1,
    },
  ],
  support_requests: [
    {
      type: 'Coaching',
      count: 2,
    },
  ],
  missing_orgs: [],
  meta: {
    total_check_ins: 12,
    visible_org_count: 4,
    missing_org_count: 0,
  },
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildNotificationsResponse(
  notifications: typeof NOTIFICATIONS_RESPONSE.notifications,
  unreadCount = notifications.filter((notification) => !notification.is_read).length,
) {
  return {
    notifications: cloneJson(notifications),
    meta: {
      total: notifications.length,
      unread_count: unreadCount,
    },
  };
}

function parseJsonBody(request: ReturnType<Route['request']>) {
  const rawBody = request.postData();
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function createMockApiHandler() {
  const currentSundayBusinessResponse = cloneJson(SUNDAY_BUSINESS_RESPONSE);
  const currentNotifications = cloneJson(NOTIFICATIONS_RESPONSE.notifications);
  const currentSettingsResponse = cloneJson(SETTINGS_RESPONSE);

  return async function handleMockApi(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const method = request.method();

  if (path === '/api/auth/me' && method === 'GET') {
    return json(route, { user: MOCK_USER });
  }

  if (path === '/api/calling-requests/action-required' && method === 'GET') {
    return json(route, { success: true, action_required: [], meta: { total: 0 } });
  }

  if (path === '/api/agendas/my-items' && method === 'GET') {
    return json(route, { items: [] });
  }

  if (path === '/api/reports/align-pulse' && method === 'GET') {
    return json(route, PULSE_REPORT_RESPONSE);
  }

  if (path === '/api/notifications' && method === 'GET') {
    if (url.searchParams.get('unread_only') === 'true') {
      const unreadNotifications = currentNotifications.filter((notification) => !notification.is_read);
      return json(route, buildNotificationsResponse(unreadNotifications));
    }
    return json(
      route,
      buildNotificationsResponse(
        currentNotifications,
        currentNotifications.filter((notification) => !notification.is_read).length,
      ),
    );
  }

  if (path === '/api/notifications/read-all' && method === 'POST') {
    currentNotifications.forEach((notification) => {
      notification.is_read = true;
    });
    return json(route, { success: true });
  }

  if (/^\/api\/notifications\/\d+\/(read|unread)$/.test(path) && method === 'POST') {
    const notificationId = Number(path.match(/^\/api\/notifications\/(\d+)\/(read|unread)$/)?.[1] ?? 0);
    const nextReadState = path.endsWith('/read');
    const targetNotification = currentNotifications.find((notification) => notification.id === notificationId);
    if (targetNotification) {
      targetNotification.is_read = nextReadState;
    }
    return json(route, { success: true });
  }

  if (/^\/api\/notifications\/\d+$/.test(path) && method === 'DELETE') {
    const notificationId = Number(path.match(/^\/api\/notifications\/(\d+)$/)?.[1] ?? 0);
    const notificationIndex = currentNotifications.findIndex((notification) => notification.id === notificationId);
    if (notificationIndex >= 0) {
      currentNotifications.splice(notificationIndex, 1);
    }
    return json(route, { success: true });
  }

  if (path === '/api/user/settings' && method === 'GET') {
    return json(route, currentSettingsResponse);
  }

  if (path === '/api/user/settings' && method === 'PATCH') {
    const body = parseJsonBody(request);
    const mutedCategories = body.muted_notification_categories;
    const emailFrequency = body.email_notification_frequency;

    if (Array.isArray(mutedCategories)) {
      currentSettingsResponse.preferences.muted_notification_categories = mutedCategories.filter(
        (value): value is string => typeof value === 'string',
      );
    }

    if (typeof emailFrequency === 'string') {
      currentSettingsResponse.preferences.email_notification_frequency = emailFrequency;
    }

    return json(route, { success: true });
  }

  if (path === '/api/calling-requests/pending-action-count' && method === 'GET') {
    return json(route, { pending_action_count: 1 });
  }

  if (path === '/api/calling-requests/submission-context' && method === 'GET') {
    return json(route, {
      allowed_scopes: ['ward'],
      allowed_wards: [{ id: PRIMARY_WARD_ID, name: 'Cloverdale Ward' }],
      can_create: true,
    });
  }

  if (path === '/api/reference/wards' && method === 'GET') {
    return json(route, {
      wards: [
        { id: PRIMARY_WARD_ID, name: 'Cloverdale Ward' },
        { id: COMPLETED_WARD_ID, name: 'Fleetwood Ward' },
      ],
    });
  }

  if (path === '/api/reference/callings' && method === 'GET') {
    return json(route, {
      callings: [
        {
          id: 501,
          name: 'Ward Choir Director',
          level: 'ward',
          organization_type: 'music',
        },
        {
          id: 502,
          name: 'Ward Music Chair',
          level: 'ward',
          organization_type: 'music',
        },
      ],
    });
  }

  if (path === '/api/reference/organizations' && method === 'GET') {
    return json(route, {
      organizations: [
        {
          id: 700,
          name: 'Ward Music',
          type: 'music',
        },
      ],
    });
  }

  if (/^\/api\/reference\/current-holders\/\d+$/.test(path) && method === 'GET') {
    return json(route, {
      holders: [
        {
          user_id: 201,
          user_name: 'Existing Holder',
          label: 'Existing Holder',
          ward_id: PRIMARY_WARD_ID,
        },
      ],
    });
  }

  if (path === '/api/calling-requests' && method === 'GET') {
    return json(route, CALLING_LIST_RESPONSE);
  }

  if (path === '/api/calling-requests' && method === 'POST') {
    return json(route, {
      success: true,
      id: 777,
      calling_request: { id: 777 },
    });
  }

  if (path === `/api/calling-requests/${CALLING_REQUEST_ID}` && method === 'GET') {
    return json(route, CALLING_DETAIL_RESPONSE);
  }

  if (/^\/api\/calling-requests\/\d+\/submit$/.test(path) && method === 'POST') {
    return json(route, { success: true });
  }

  if (path === '/api/sunday-business/sunday' && method === 'GET') {
    return json(route, currentSundayBusinessResponse);
  }

  if (/^\/api\/sunday-business\/\d+\/complete-ward$/.test(path) && method === 'POST') {
    const targetItemId = Number(path.match(/^\/api\/sunday-business\/(\d+)\/complete-ward$/)?.[1] ?? 0);
    const targetItem = currentSundayBusinessResponse.business_items.find((item) => item.id === targetItemId);
    const bundleId = targetItem?.bundle_id ?? null;
    const affectedItems = currentSundayBusinessResponse.business_items.filter((item) => {
      const currentBundleId = item.bundle_id ?? null;
      if (bundleId !== null) return currentBundleId === bundleId;
      return item.id === targetItemId;
    });

    for (const item of affectedItems) {
      if (!item.wards_completed.includes(PRIMARY_WARD_ID)) {
        item.wards_completed = [...item.wards_completed, PRIMARY_WARD_ID];
      }
      item.wards_outstanding = item.wards_outstanding.filter((wardId) => wardId !== PRIMARY_WARD_ID);
      item.completion_progress = 100;
    }

    return json(route, {
      success: true,
      items_completed: affectedItems.length,
      bundle_id: bundleId,
      completion: {
        ward_id: PRIMARY_WARD_ID,
        ward_name: 'Cloverdale Ward',
        conducted_at: '2026-03-23T18:00:00Z',
        conducted_by: MOCK_USER.name,
      },
      updated_items: affectedItems.map((item) => ({
        id: item.id,
        status: 'completed',
        wards_completed: item.wards_completed,
        wards_outstanding: item.wards_outstanding,
      })),
      calling_step_updated: true,
    });
  }

  return json(
    route,
    {
      message: `Unhandled mock request: ${method} ${path}`,
    },
    500,
  );
}
}

async function seedMockedSession(page: Page) {
  await page.addInitScript(
    ({ token, user, fixedNowIso }) => {
      const RealDate = Date;
      const fixedNowMs = new RealDate(fixedNowIso).valueOf();

      class MockDate extends RealDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          if (args.length === 0) {
            super(fixedNowMs);
            return;
          }
          super(...args);
        }

        static now() {
          return fixedNowMs;
        }

        static parse(dateString: string) {
          return RealDate.parse(dateString);
        }

        static UTC(...args: Parameters<typeof Date.UTC>) {
          return RealDate.UTC(...args);
        }
      }

      Object.setPrototypeOf(MockDate, RealDate);
      globalThis.Date = MockDate as typeof Date;
      window.localStorage.setItem('sa_token', token);
      window.localStorage.setItem('sa_user', JSON.stringify(user));
    },
    { token: MOCK_TOKEN, user: MOCK_USER, fixedNowIso: FIXED_NOW_ISO },
  );

  await page.route('**/api/**', createMockApiHandler());
}

export async function openMockedRoute(page: Page, path: string) {
  await seedMockedSession(page);
  await page.goto(path);
}

export async function openMockedApp(page: Page) {
  await openMockedRoute(page, '/');
  await expect(page.getByText('Quick Access')).toBeVisible();
}

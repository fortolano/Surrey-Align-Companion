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

const REFERENCE_CALLINGS = [
  {
    id: 501,
    name: 'Stake Assistant Executive Secretary',
    level: 'stake',
    category: 'stake_presidency',
    organization_type: 'stake_presidency',
  },
  {
    id: 502,
    name: 'Stake Relief Society Secretary',
    level: 'stake',
    category: 'relief_society',
    organization_type: 'relief_society',
  },
  {
    id: 503,
    name: 'Bishopric First Counselor',
    level: 'ward',
    category: 'bishopric',
    organization_type: 'bishopric',
  },
  {
    id: 504,
    name: 'Ward Clerk',
    level: 'ward',
    category: 'administration',
    organization_type: 'bishopric',
  },
  {
    id: 505,
    name: 'Elders Quorum President',
    level: 'ward',
    category: 'elders_quorum',
    organization_type: 'elders_quorum',
  },
  {
    id: 506,
    name: 'Ward Choir Director',
    level: 'ward',
    category: 'music',
    organization_type: 'music',
  },
  {
    id: 507,
    name: 'Branch Presidency First Counselor',
    level: 'branch',
    category: 'bishopric',
    organization_type: 'presidency',
  },
  {
    id: 508,
    name: 'Branch Clerk',
    level: 'branch',
    category: 'administration',
    organization_type: 'presidency',
  },
];

const STAKE_ASSIGNMENTS = {
  organizations: [
    { id: 700, name: 'Stake Presidency', kind: 'organization', level: 'stake', ward_id: null, type: 'stake_presidency' },
    { id: 701, name: 'Stake Relief Society', kind: 'organization', level: 'stake', ward_id: null, type: 'relief_society' },
  ],
  councils: [
    { id: 801, name: 'High Council', kind: 'council', level: 'stake', ward_id: null, type: 'council' },
    { id: 802, name: 'Stake Communication Council', kind: 'council', level: 'stake', ward_id: null, type: 'council' },
    { id: 803, name: 'Stake Youth Leadership Committee', kind: 'council', level: 'stake', ward_id: null, type: 'committee' },
  ],
};

const LOCAL_ASSIGNMENTS = [
  { id: 710, name: 'Cloverdale Bishopric', kind: 'organization', level: 'ward', ward_id: PRIMARY_WARD_ID, type: 'bishopric' },
  { id: 711, name: 'Cloverdale Elders Quorum', kind: 'organization', level: 'ward', ward_id: PRIMARY_WARD_ID, type: 'elders_quorum' },
  { id: 712, name: 'Cloverdale Ward Music', kind: 'organization', level: 'ward', ward_id: PRIMARY_WARD_ID, type: 'music' },
  { id: 720, name: 'Fleetwood Branch Presidency', kind: 'organization', level: 'branch', ward_id: COMPLETED_WARD_ID, type: 'presidency' },
  { id: 721, name: 'Fleetwood Branch Elders Quorum', kind: 'organization', level: 'branch', ward_id: COMPLETED_WARD_ID, type: 'elders_quorum' },
];

const MOCK_HOLDERS_BY_CALLING: Record<string, Array<{ user_id: number; user_name: string; label: string; ward_id: number | null }>> = {
  '501': [
    { user_id: 201, user_name: 'Stake Executive Secretary Holder', label: 'Stake Executive Secretary Holder', ward_id: null },
  ],
  '503': [
    { user_id: 202, user_name: 'Cloverdale Counselor', label: 'Cloverdale Counselor', ward_id: PRIMARY_WARD_ID },
  ],
  '504': [
    { user_id: 203, user_name: 'Cloverdale Clerk', label: 'Cloverdale Clerk', ward_id: PRIMARY_WARD_ID },
  ],
  '507': [
    { user_id: 204, user_name: 'Fleetwood Counselor', label: 'Fleetwood Counselor', ward_id: COMPLETED_WARD_ID },
  ],
};

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
      target_ward_unit_type: 'ward',
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
      unit_type: 'ward',
    },
    ward: {
      id: PRIMARY_WARD_ID,
      name: 'Cloverdale Ward',
      unit_type: 'ward',
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
    can_request_feedback: true,
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
      app_action: {
        kind: 'native_screen',
        name: 'calling_request.detail',
        params: {
          calling_request_id: CALLING_REQUEST_ID,
          tab: 'discussion',
        },
        fallback_url: `https://surreyalign.org/calling-requests/${CALLING_REQUEST_ID}`,
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
  push_notifications_enabled: true,
  preferences: {
    muted_notification_categories: [],
    email_notification_frequency: 'daily',
    push_notification_enabled: true,
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

function isStakeReviewedLocalCallingMock(callingId?: string | null) {
  return ['503', '504', '505', '507'].includes(String(callingId || ''));
}

function buildMockCallingResponse(scope: string | null, unitType: string | null) {
  if (!scope) {
    return REFERENCE_CALLINGS;
  }

  if (scope === 'stake') {
    return REFERENCE_CALLINGS.filter((calling) => {
      if (calling.level === 'stake') {
        return true;
      }

      if (!isStakeReviewedLocalCallingMock(String(calling.id))) {
        return false;
      }

      if (unitType === 'ward') {
        return calling.level === 'ward';
      }

      if (unitType === 'branch') {
        return calling.level === 'branch' || calling.level === 'ward';
      }

      return true;
    });
  }

  if (scope === 'ward') {
    if (unitType === 'branch') {
      return REFERENCE_CALLINGS.filter((calling) => calling.level === 'branch' || calling.level === 'ward');
    }

    return REFERENCE_CALLINGS.filter((calling) => calling.level === 'ward');
  }

  return REFERENCE_CALLINGS;
}

function buildMockAssignmentResponse(
  scope: string | null,
  unitType: string | null,
  wardId: string | null,
  targetCallingId: string | null,
) {
  const usesLocalUnitContext = scope === 'ward' || (scope === 'stake' && isStakeReviewedLocalCallingMock(targetCallingId));

  if (!usesLocalUnitContext) {
    const assignmentOptions = [...STAKE_ASSIGNMENTS.councils, ...STAKE_ASSIGNMENTS.organizations];

    return {
      success: true,
      uses_local_unit_context: false,
      organizations: STAKE_ASSIGNMENTS.organizations,
      councils: STAKE_ASSIGNMENTS.councils,
      assignment_options: assignmentOptions,
    };
  }

  if (!unitType) {
    return {
      success: true,
      uses_local_unit_context: true,
      organizations: [],
      councils: [],
      assignment_options: [],
    };
  }

  const organizations = LOCAL_ASSIGNMENTS.filter((option) => {
    if (option.level !== unitType) {
      return false;
    }

    return !wardId || String(option.ward_id) === String(wardId);
  });

  return {
    success: true,
    uses_local_unit_context: true,
    organizations,
    councils: [],
    assignment_options: organizations,
  };
}

function createMockApiHandler() {
  const currentSundayBusinessResponse = cloneJson(SUNDAY_BUSINESS_RESPONSE);
  const currentNotifications = cloneJson(NOTIFICATIONS_RESPONSE.notifications);
  const currentSettingsResponse = cloneJson(SETTINGS_RESPONSE);
  const currentCallingListResponse = cloneJson(CALLING_LIST_RESPONSE);
  const currentCallingDetailResponse = cloneJson(CALLING_DETAIL_RESPONSE);
  const feedbackCandidates = [
    {
      id: 301,
      name: 'Emilio Silva Jr.',
      label: 'Emilio Silva Jr. — Surrey 4th, Stake High Councilor',
      priority: 'high',
      is_quick_pick: true,
    },
    {
      id: 302,
      name: 'Nathan Brown',
      label: 'Nathan Brown — Cloverdale Ward, Bishop',
      priority: 'high',
      is_quick_pick: true,
    },
    {
      id: 303,
      name: 'Maria Lopez',
      label: 'Maria Lopez — Stake Relief Society President',
      priority: 'medium',
      is_quick_pick: true,
    },
    {
      id: 304,
      name: 'David Hall',
      label: 'David Hall — Stake Executive Secretary',
      priority: 'medium',
      is_quick_pick: true,
    },
    {
      id: 305,
      name: 'Peter Chan',
      label: 'Peter Chan — Fleetwood Branch Presidency Counselor',
      priority: 'medium',
      is_quick_pick: false,
    },
  ];

  return async function handleMockApi(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const method = request.method();

  if (path === '/api/auth/me' && method === 'GET') {
    return json(route, { user: MOCK_USER });
  }

  if (path === '/api/auth/login' && method === 'POST') {
    return json(route, {
      success: true,
      token: MOCK_TOKEN,
      user: MOCK_USER,
    });
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    return json(route, { success: true });
  }

  if (path === '/api/calling-requests/action-required' && method === 'GET') {
    return json(route, { success: true, action_required: [], meta: { total: 0 } });
  }

  if (path === '/api/agendas/my-items' && method === 'GET') {
    return json(route, { success: true, items: [], meta: { total: 0 } });
  }

  if (path === '/api/agendas/entities' && method === 'GET') {
    return json(route, { success: true, entities: [], meta: { total: 0 } });
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
    const pushEnabled = body.push_notification_enabled;

    if (Array.isArray(mutedCategories)) {
      currentSettingsResponse.preferences.muted_notification_categories = mutedCategories.filter(
        (value): value is string => typeof value === 'string',
      );
    }

    if (typeof emailFrequency === 'string') {
      currentSettingsResponse.preferences.email_notification_frequency = emailFrequency;
    }

    if (typeof pushEnabled === 'boolean') {
      currentSettingsResponse.preferences.push_notification_enabled = pushEnabled;
    }

    return json(route, { success: true });
  }

  if (path === '/api/notifications/push-config' && method === 'GET') {
    return json(route, {
      success: true,
      push_enabled: currentSettingsResponse.push_notifications_enabled && currentSettingsResponse.preferences.push_notification_enabled,
      stake_notifications_enabled: currentSettingsResponse.notifications_enabled,
      stake_push_enabled: currentSettingsResponse.push_notifications_enabled,
      user_push_enabled: currentSettingsResponse.preferences.push_notification_enabled,
      public_key: 'mock-public-key',
    });
  }

  if (path === '/api/notifications/push-subscriptions' && method === 'POST') {
    return json(route, { success: true, subscription: { id: 1, is_active: true } });
  }

  if (path === '/api/notifications/push-subscriptions/current' && method === 'DELETE') {
    return json(route, { success: true });
  }

  if (path === '/api/calling-requests/pending-action-count' && method === 'GET') {
    return json(route, { pending_action_count: 1 });
  }

  if (path === '/api/speaking-assignments/pending-action-count' && method === 'GET') {
    return json(route, { pending_action_count: 0 });
  }

  if (path === '/api/calling-requests/submission-context' && method === 'GET') {
    return json(route, {
      allowed_levels: ['stake', 'local_unit'],
      allowed_scopes: ['stake', 'ward'],
      allowed_local_units: [
        { id: PRIMARY_WARD_ID, name: 'Cloverdale Ward', unit_type: 'ward' },
        { id: COMPLETED_WARD_ID, name: 'Fleetwood Branch', unit_type: 'branch' },
      ],
      allowed_wards: [{ id: PRIMARY_WARD_ID, name: 'Cloverdale Ward', unit_type: 'ward' }],
      can_create: true,
    });
  }

  if (path === '/api/reference/wards' && method === 'GET') {
    return json(route, {
      wards: [
        { id: PRIMARY_WARD_ID, name: 'Cloverdale Ward', unit_type: 'ward' },
        { id: COMPLETED_WARD_ID, name: 'Fleetwood Branch', unit_type: 'branch' },
      ],
    });
  }

  if (path === '/api/reference/callings' && method === 'GET') {
    const scope = url.searchParams.get('scope');
    const unitType = url.searchParams.get('unit_type');

    return json(route, {
      callings: buildMockCallingResponse(scope, unitType),
    });
  }

  if (path === '/api/reference/organizations' && method === 'GET') {
    if (url.searchParams.get('mode') === 'calling_request') {
      return json(
        route,
        buildMockAssignmentResponse(
          url.searchParams.get('scope'),
          url.searchParams.get('unit_type'),
          url.searchParams.get('ward_id'),
          url.searchParams.get('target_calling_id'),
        ),
      );
    }

    return json(route, {
      organizations: [...STAKE_ASSIGNMENTS.organizations, ...LOCAL_ASSIGNMENTS],
    });
  }

  if (/^\/api\/reference\/current-holders\/\d+$/.test(path) && method === 'GET') {
    const callingId = path.match(/^\/api\/reference\/current-holders\/(\d+)$/)?.[1] || '';
    const wardId = url.searchParams.get('ward_id');

    return json(route, {
      holders: (MOCK_HOLDERS_BY_CALLING[callingId] || []).filter((holder) => (
        !wardId || String(holder.ward_id || '') === wardId
      )),
    });
  }

  if (path === '/api/calling-requests' && method === 'GET') {
    return json(route, currentCallingListResponse);
  }

  if (path === '/api/calling-requests' && method === 'POST') {
    return json(route, {
      success: true,
      id: 777,
      calling_request: { id: 777 },
    });
  }

  if (path === `/api/calling-requests/${CALLING_REQUEST_ID}` && method === 'GET') {
    return json(route, currentCallingDetailResponse);
  }

  if (/^\/api\/calling-requests\/\d+\/submit$/.test(path) && method === 'POST') {
    return json(route, { success: true });
  }

  if (path === `/api/calling-requests/${CALLING_REQUEST_ID}/feedback-candidates` && method === 'GET') {
    return json(route, {
      success: true,
      candidates: feedbackCandidates,
      quick_picks: feedbackCandidates.filter((candidate) => candidate.is_quick_pick),
    });
  }

  if (path === `/api/calling-requests/${CALLING_REQUEST_ID}/request-feedback` && method === 'POST') {
    const body = parseJsonBody(request);
    const requestedOfUserId = Number(body.requested_of_user_id ?? 0);
    const requestedLeader = feedbackCandidates.find((candidate) => candidate.id === requestedOfUserId);
    const newFeedbackRequest = {
      id: Date.now(),
      requested_by: { id: MOCK_USER.id, name: MOCK_USER.name },
      requested_of: requestedLeader ? { id: requestedLeader.id, name: requestedLeader.name } : null,
      reason: typeof body.reason === 'string' ? body.reason : null,
      response: null,
      responded_at: null,
      is_pending: true,
    };

    currentCallingDetailResponse.calling_request.feedback_requests = [
      ...(currentCallingDetailResponse.calling_request.feedback_requests || []),
      newFeedbackRequest,
    ];

    return json(route, { success: true, feedback_request: newFeedbackRequest }, 201);
  }

  if (/^\/api\/calling-requests\/\d+\/respond-feedback\/\d+$/.test(path) && method === 'POST') {
    const feedbackRequestId = Number(path.match(/^\/api\/calling-requests\/\d+\/respond-feedback\/(\d+)$/)?.[1] ?? 0);
    const body = parseJsonBody(request);
    const feedbackRequests = currentCallingDetailResponse.calling_request.feedback_requests || [];
    const targetFeedback = feedbackRequests.find((feedbackRequest) => feedbackRequest.id === feedbackRequestId);

    if (targetFeedback) {
      targetFeedback.response = typeof body.response === 'string' ? body.response : '';
      targetFeedback.responded_at = FIXED_NOW_ISO;
      targetFeedback.is_pending = false;
    }

    return json(route, { success: true, feedback_request: targetFeedback ?? null });
  }

  if (path === `/api/calling-requests/${CALLING_REQUEST_ID}/presidency-recommendation` && method === 'POST') {
    const body = parseJsonBody(request);
    const recommendation = body.recommendation === 'not_approve' ? 'Not Approved' : 'Approve';
    const commentBody = typeof body.comment === 'string' && body.comment.trim().length > 0 ? `\n${body.comment.trim()}` : '';
    const recommendationComment = {
      id: Date.now(),
      author: { id: MOCK_USER.id, name: MOCK_USER.name },
      comment: `Recommendation: ${recommendation}${commentBody}`,
      phase: 'presidency_recommendation',
      created_at: FIXED_NOW_ISO,
    };
    const comments = currentCallingDetailResponse.calling_request.comments || [];
    const existingIndex = comments.findIndex((comment) => comment.phase === 'presidency_recommendation' && comment.author?.id === MOCK_USER.id);
    if (existingIndex >= 0) {
      comments[existingIndex] = recommendationComment;
    } else {
      comments.push(recommendationComment);
    }
    currentCallingDetailResponse.calling_request.comments = comments;

    return json(route, { success: true, recommendation: recommendationComment });
  }

  if (path === `/api/calling-requests/${CALLING_REQUEST_ID}/comments` && method === 'POST') {
    const body = parseJsonBody(request);
    const newComment = {
      id: Date.now(),
      author: { id: MOCK_USER.id, name: MOCK_USER.name },
      comment: typeof body.comment === 'string' ? body.comment : '',
      phase: 'discussion',
      created_at: FIXED_NOW_ISO,
    };
    currentCallingDetailResponse.calling_request.comments = [
      ...(currentCallingDetailResponse.calling_request.comments || []),
      newComment,
    ];

    return json(route, { success: true, comment: newComment }, 201);
  }

  if (path === `/api/calling-requests/${CALLING_REQUEST_ID}/decide` && method === 'POST') {
    const body = parseJsonBody(request);
    currentCallingDetailResponse.calling_request.status = body.decision === 'not_approve' ? 'not_approved' : 'approved';
    currentCallingDetailResponse.calling_request.status_label = body.decision === 'not_approve' ? 'Not Approved' : 'Approved';
    currentCallingDetailResponse.calling_request.decision_feedback = typeof body.feedback === 'string' ? body.feedback : null;
    currentCallingDetailResponse.calling_request.decided_at = FIXED_NOW_ISO;

    return json(route, { success: true, calling_request: currentCallingDetailResponse.calling_request });
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
    ({ fixedNowIso, token, user }) => {
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
    { fixedNowIso: FIXED_NOW_ISO, token: MOCK_TOKEN, user: MOCK_USER },
  );

  await page.route('**/api/**', createMockApiHandler());
}

export async function openMockedRoute(page: Page, path: string) {
  await seedMockedSession(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  let bootedIntoHome = false;
  try {
    await page.getByText('Quick Access').waitFor({ state: 'visible', timeout: 6000 });
    bootedIntoHome = true;
  } catch {
    await page.getByTestId('email-input').waitFor({ state: 'visible', timeout: 10000 });
  }

  if (!bootedIntoHome) {
    await page.getByTestId('email-input').fill(MOCK_USER.email);
    await page.getByTestId('password-input').fill('playwright-password');
    await page.getByTestId('login-button').click();
    await page.getByText('Quick Access').waitFor({ state: 'visible', timeout: 12000 });
    await page.waitForURL(/\/(?:\?.*)?$/);
  }

  if (path === '/' || path === '') {
    return;
  }

  if (path === '/notifications') {
    await page.getByTestId('tab-notifications').click();
    await page.waitForURL(/\/notifications(?:\?|$)/);
    return;
  }

  if (path === '/settings') {
    await page.getByTestId('avatar-menu-btn').click();
    await page.getByText('Settings').click();
    await page.waitForURL(/\/settings(?:\?|$)/);
    return;
  }

  if (path.startsWith('/calling-detail')) {
    await page.getByTestId('tab-notifications').click();
    await page.waitForURL(/\/notifications(?:\?|$)/);
    await page.getByTestId('notification-row-9101').click();
    await page.waitForURL(/\/calling-detail(?:\?|$)/);
    return;
  }

  await page.goto(path, { waitUntil: 'networkidle' });
}

export async function openMockedApp(page: Page) {
  await openMockedRoute(page, '/');
  await expect(page.getByText('Quick Access')).toBeVisible();
}

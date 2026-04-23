import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginToApp } from './support/auth';
import { getLiveCredentials, type LiveTestAccount } from './support/live-credentials';

const CARRY_FORWARD_ACCOUNT_CANDIDATES: LiveTestAccount[] = ['stake', 'ward', 'branch'];

async function loginViaApi(request: APIRequestContext, accountOverride?: LiveTestAccount) {
  const { email, password } = getLiveCredentials(accountOverride);

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

async function findCarryForwardEntity(request: APIRequestContext) {
  for (const account of CARRY_FORWARD_ACCOUNT_CANDIDATES) {
    let token: string;

    try {
      token = await loginViaApi(request, account);
    } catch {
      continue;
    }

    const entityResponse = await authGet(request, token, '/api/agendas/entities');

    if (!entityResponse.ok()) {
      continue;
    }

    const entityData = await entityResponse.json();
    const entities = entityData.entities ?? [];
    let fallbackEntity: {
      entity_type: string;
      entity_id: number;
      entity_name: string;
    } | null = null;

    for (const entity of entities) {
      const listResponse = await authGet(
        request,
        token,
        `/api/carry-forward/entities/${entity.entity_type}/${entity.entity_id}?status=open`,
      );

      if (listResponse.ok()) {
        const listData = await listResponse.json();

        if (!fallbackEntity) {
          fallbackEntity = entity as {
            entity_type: string;
            entity_id: number;
            entity_name: string;
          };
        }

        return {
          account,
          entity: entity as {
            entity_type: string;
            entity_id: number;
            entity_name: string;
          },
          firstItemId: listData.items?.[0]?.id ? Number(listData.items[0].id) : null,
        };
      }
    }

    if (fallbackEntity) {
      return {
        account,
        entity: fallbackEntity,
        firstItemId: null,
      };
    }
  }

  throw new Error('No accessible carry-forward entity was found in the live smoke accounts.');
}

async function findAgendaCarryForwardScenario(request: APIRequestContext) {
  for (const account of CARRY_FORWARD_ACCOUNT_CANDIDATES) {
    let token: string;

    try {
      token = await loginViaApi(request, account);
    } catch {
      continue;
    }

    const entityResponse = await authGet(request, token, '/api/agendas/entities');

    if (!entityResponse.ok()) {
      continue;
    }

    const entityData = await entityResponse.json();
    const entities = entityData.entities ?? [];

    for (const entity of entities) {
      const agendaCandidates = [
        entity.current_agenda_id
          ? { agendaId: entity.current_agenda_id as number, tab: 'current' as const }
          : null,
        entity.latest_past_agenda_id
          ? { agendaId: entity.latest_past_agenda_id as number, tab: 'past' as const }
          : null,
      ].filter(Boolean) as Array<{ agendaId: number; tab: 'current' | 'past' }>;

      for (const candidate of agendaCandidates) {
        const agendaResponse = await authGet(request, token, `/api/agendas/${candidate.agendaId}`);

        if (!agendaResponse.ok()) {
          continue;
        }

        const agendaData = await agendaResponse.json();
        const agenda = agendaData.agenda;

        const surfacedItemId = agenda?.carry_forward_context?.groups
          ?.flatMap((group: any) => group.items ?? [])
          ?.find((item: any) => typeof item?.id === 'number')
          ?.id;

        if (surfacedItemId) {
          return {
            account,
            entityType: entity.entity_type as string,
            entityId: entity.entity_id as number,
            agendaId: candidate.agendaId,
            tab: candidate.tab,
            itemId: surfacedItemId as number,
            source: 'surface' as const,
          };
        }

        const itemLevelEntry = agenda?.sections
          ?.flatMap((section: any) => section.items ?? [])
          ?.find((item: any) => typeof item?.carry_forward_context?.id === 'number');

        if (itemLevelEntry?.carry_forward_context?.id) {
          return {
            account,
            entityType: entity.entity_type as string,
            entityId: entity.entity_id as number,
            agendaId: candidate.agendaId,
            tab: candidate.tab,
            itemId: itemLevelEntry.carry_forward_context.id as number,
            source: 'item' as const,
          };
        }
      }
    }
  }

  return null;
}

test('live account can sign in and reach the home shell', async ({ page }) => {
  const { account } = getLiveCredentials();

  await loginToApp(page);

  await expect(page).toHaveURL(/\/(?:\?.*)?$/);

  if (account === 'ward') {
    await expect(page.getByTestId('bishop-home-tab-screen')).toBeVisible();
    await expect(page.getByText('Bishop Home')).toBeVisible();
    await expect(page.getByTestId('bishop-home-card-sacrament_meeting')).toBeVisible();
    return;
  }

  await expect(page.getByText('Quick Access')).toBeVisible();
  await expect(page.getByTestId('quick-goals')).toBeVisible();
});

test('live account can open the leadership intelligence inbox route', async ({ page }) => {
  await loginToApp(page);

  await page.goto('/intelligence-inbox');

  await expect(page).toHaveURL(/\/intelligence-inbox(?:\?|$)/);
  await expect(page.getByTestId('intelligence-inbox-screen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leadership Intelligence' })).toBeVisible();
});

test('ward bishop account can open the direct bishop-home route', async ({ page }) => {
  const { account } = getLiveCredentials();

  test.skip(account !== 'ward', 'Direct bishop-home smoke uses the ward bishop account.');

  await loginToApp(page);

  await page.goto('/bishop-home?weekStart=2026-04-06');

  await expect(page).toHaveURL(/\/bishop-home\?weekStart=2026-04-06/);
  await expect(page.getByTestId('bishop-home-route-screen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bishop Home' })).toBeVisible();
  await expect(page.getByTestId('bishop-home-week-current').getByText('Apr 6–12')).toBeVisible();
});

test('live account with agenda access can open carry-forward from More and load an entity list', async ({ page, request }) => {
  const scenario = await findCarryForwardEntity(request);

  await loginToApp(page, scenario.account);
  await page.goto('/more');

  await expect(page.getByTestId('more-item-carry-forward')).toBeVisible();
  await page.getByTestId('more-item-carry-forward').click();

  await expect(page.getByTestId('carry-forward-chooser-screen')).toBeVisible();
  await page.getByTestId(`carry-forward-entity-${scenario.entity.entity_type}-${scenario.entity.entity_id}`).click();

  await expect(page.getByTestId('carry-forward-list-screen')).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`/carry-forward\\?entityType=${scenario.entity.entity_type}&entityId=${scenario.entity.entity_id}`),
  );

  if (scenario.firstItemId) {
    await expect(page.getByTestId(`carry-forward-item-${scenario.firstItemId}`)).toBeVisible();
    await page.getByTestId(`carry-forward-item-${scenario.firstItemId}`).click();
    await expect(page.getByTestId('carry-forward-detail-screen')).toBeVisible();
  }
});

test('live account with agenda context can open carry-forward detail from an agenda surface', async ({ page, request }) => {
  const scenario = await findAgendaCarryForwardScenario(request);
  test.skip(!scenario, 'No live agenda-linked carry-forward context is currently available in the shared smoke accounts.');

  await loginToApp(page, scenario.account);
  await page.goto(
    `/agenda-entity?entityType=${scenario.entityType}&entityId=${scenario.entityId}&agendaId=${scenario.agendaId}&tab=${scenario.tab}`,
  );

  if (scenario.source === 'surface') {
    await expect(page.getByTestId(`agenda-carry-forward-surface-item-${scenario.itemId}`)).toBeVisible();
    await page.getByTestId(`agenda-carry-forward-surface-item-${scenario.itemId}`).click();
  } else {
    await expect(page.getByTestId(`agenda-item-carry-forward-${scenario.itemId}`)).toBeVisible();
    await page.getByTestId(`agenda-item-carry-forward-${scenario.itemId}`).click();
  }

  await expect(page.getByTestId('carry-forward-detail-screen')).toBeVisible();
  await expect(page).toHaveURL(/\/carry-forward-detail\?/);
});

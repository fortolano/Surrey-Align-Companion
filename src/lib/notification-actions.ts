import { buildPathWithParams } from '@/lib/navigation-return-target';

export interface NotificationAppAction {
  kind?: string | null;
  name?: string | null;
  params?: Record<string, unknown> | null;
  fallback_url?: string | null;
}

export interface NotificationLike {
  app_action?: NotificationAppAction | null;
  action_url?: string | null;
  related_type?: string | null;
  related_id?: number | null;
  type?: string | null;
}

export type NotificationNavigationTarget =
  | { kind: 'internal'; path: string }
  | { kind: 'external'; url: string };

const SAME_APP_FALLBACK_PATHS = new Set([
  '/notifications',
  '/calling-detail',
  '/goal-detail',
  '/agenda-entity',
  '/assignments',
  '/sunday-business',
  '/speaking-assignments',
  '/align-pulse',
  '/sacrament-overview',
]);

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value) && value.length > 0) {
    return firstString(value[0]);
  }

  return undefined;
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    if (typeof window !== 'undefined') {
      return new URL(url, window.location.origin).toString();
    }

    return url;
  } catch {
    return null;
  }
}

function sameAppTarget(url: string | null | undefined): NotificationNavigationTarget | null {
  if (!url || typeof window === 'undefined') return null;

  try {
    const resolved = new URL(url, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return null;
    }

    if (!SAME_APP_FALLBACK_PATHS.has(resolved.pathname)) {
      return null;
    }

    return {
      kind: 'internal',
      path: `${resolved.pathname}${resolved.search}${resolved.hash}`,
    };
  } catch {
    return null;
  }
}

function buildInternalPath(
  pathname: string,
  returnTo: string,
  params?: Record<string, string | number | boolean | string[] | undefined | null>
): NotificationNavigationTarget {
  return {
    kind: 'internal',
    path: buildPathWithParams(pathname, {
      ...(params ?? {}),
      returnTo,
    }),
  };
}

function resolveAppActionTarget(
  action: NotificationAppAction,
  returnTo: string
): NotificationNavigationTarget | null {
  const fallbackUrl = absoluteUrl(action.fallback_url);
  const sameAppFallbackTarget = sameAppTarget(fallbackUrl);
  const params = action.params ?? {};
  const actionName = action.name ?? '';

  switch (actionName) {
    case 'calling_request.detail': {
      const id = firstString(params.calling_request_id);
      if (!id) break;

      return buildInternalPath('/calling-detail', returnTo, {
        id,
        tab: firstString(params.tab),
      });
    }

    case 'goal.detail': {
      const goalId = firstString(params.goal_id) ?? firstString(params.goalId);
      if (!goalId) break;

      return buildInternalPath('/goal-detail', returnTo, { goalId });
    }

    case 'agenda.detail': {
      const agendaId = firstString(params.agenda_id) ?? firstString(params.agendaId);
      if (!agendaId) break;

      return buildInternalPath('/agenda-entity', returnTo, { agendaId });
    }

    case 'agenda.item_detail': {
      const agendaId = firstString(params.agenda_id) ?? firstString(params.agendaId);
      if (agendaId) {
        return buildInternalPath('/agenda-entity', returnTo, { agendaId });
      }

      return buildInternalPath('/assignments', returnTo);
    }

    case 'agenda.submission_detail': {
      const targetAgendaId = firstString(params.target_agenda_id) ?? firstString(params.agenda_id);
      if (targetAgendaId) {
        return buildInternalPath('/agenda-entity', returnTo, { agendaId: targetAgendaId });
      }
      break;
    }

    case 'sunday_business.index':
      return buildInternalPath('/sunday-business', returnTo);

    case 'speaking.swap_detail':
      return buildInternalPath('/speaking-assignments', returnTo);

    case 'checkin.detail':
      return buildInternalPath('/align-pulse', returnTo);

    case 'announcement.active':
      return buildInternalPath('/sacrament-overview', returnTo, {
        wardId: firstString(params.ward_id),
        announcementId: firstString(params.announcement_id),
      });

    case 'web.open':
      if (sameAppFallbackTarget) {
        return sameAppFallbackTarget;
      }
      if (fallbackUrl) {
        return { kind: 'external', url: fallbackUrl };
      }
      break;

    default:
      break;
  }

  if (sameAppFallbackTarget) {
    return sameAppFallbackTarget;
  }

  if (fallbackUrl) {
    return { kind: 'external', url: fallbackUrl };
  }

  return null;
}

function resolveLegacyTarget(
  notification: NotificationLike,
  returnTo: string
): NotificationNavigationTarget | null {
  const relatedType = notification.related_type;
  const relatedId = notification.related_id ? String(notification.related_id) : null;

  if (relatedType === 'CallingRequest' && relatedId) {
    return buildInternalPath('/calling-detail', returnTo, { id: relatedId });
  }

  if (relatedType === 'StakeBusiness') {
    return buildInternalPath('/sunday-business', returnTo);
  }

  if (relatedType === 'agenda' && relatedId) {
    return buildInternalPath('/agenda-entity', returnTo, { agendaId: relatedId });
  }

  if (
    relatedType === 'agenda_item' ||
    notification.type === 'agenda_assignment' ||
    notification.type === 'agenda_unassignment'
  ) {
    return buildInternalPath('/assignments', returnTo);
  }

  const fallbackUrl = absoluteUrl(notification.action_url);
  const sameAppFallbackTarget = sameAppTarget(fallbackUrl);
  if (sameAppFallbackTarget) {
    return sameAppFallbackTarget;
  }

  if (fallbackUrl) {
    return { kind: 'external', url: fallbackUrl };
  }

  return null;
}

export function resolveNotificationTarget(
  notification: NotificationLike,
  returnTo = '/notifications'
): NotificationNavigationTarget | null {
  const appActionTarget = notification.app_action
    ? resolveAppActionTarget(notification.app_action, returnTo)
    : null;

  if (appActionTarget) {
    return appActionTarget;
  }

  return resolveLegacyTarget(notification, returnTo);
}

export function isNotificationActionable(notification: NotificationLike): boolean {
  return resolveNotificationTarget(notification) !== null;
}

import type { Router } from 'expo-router';

type ReturnParam = string | string[] | undefined;
type RouteParams = Record<string, string | number | boolean | string[] | undefined | null>;

const DEFAULT_RETURN_TARGETS: Record<string, string> = {
  '/about-app': '/more',
  '/agenda-entity': '/',
  '/agenda-submit': '/add',
  '/align-info': '/more',
  '/align-pulse': '/',
  '/assignments': '/',
  '/calling-create': '/callings',
  '/calling-detail': '/callings',
  '/callings': '/',
  '/goal-detail': '/goals',
  '/goals': '/',
  '/high-council-agenda': '/',
  '/profile': '/more',
  '/settings': '/more',
  '/speaking-assignments': '/',
  '/stake-council-agenda': '/',
  '/sunday-business': '/',
  '/sustainings': '/',
  '/terms': '/more',
};

function normalizeRouteParams(params?: RouteParams): Record<string, string> {
  const normalized: Record<string, string> = {};

  if (!params) return normalized;

  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;

    if (Array.isArray(value)) {
      if (value[0] != null) {
        normalized[key] = String(value[0]);
      }
      return;
    }

    normalized[key] = String(value);
  });

  return normalized;
}

export function getSingleParam(value: ReturnParam): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function resolveReturnTarget(pathname: string, returnToParam?: ReturnParam): string {
  const explicitTarget = getSingleParam(returnToParam);

  if (explicitTarget && explicitTarget.startsWith('/')) {
    return explicitTarget;
  }

  return DEFAULT_RETURN_TARGETS[pathname] ?? '/';
}

export function buildPathWithParams(pathname: string, params?: RouteParams): string {
  const normalizedParams = normalizeRouteParams(params);
  const searchParams = new URLSearchParams(normalizedParams);
  const query = searchParams.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export function withReturnTarget(pathname: string, returnTo: string, params?: RouteParams) {
  return {
    pathname: pathname as any,
    params: {
      ...normalizeRouteParams(params),
      returnTo,
    },
  } as any;
}

export function navigateToReturnTarget(router: Router, pathname: string, returnToParam?: ReturnParam) {
  router.replace(resolveReturnTarget(pathname, returnToParam) as any);
}

export function getCurrentTabReturnTarget(pathname: string): string {
  if (pathname === '/add' || pathname === '/notifications' || pathname === '/more') {
    return pathname;
  }

  return '/';
}

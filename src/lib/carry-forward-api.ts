import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type {
  AgendaEntityType,
  AgendaPersonSummary,
  CarryForwardLinkedEvidenceSummary,
} from '@/lib/agenda-api';

export type CarryForwardStatusFilter = 'open' | 'waiting_for_report' | 'resolved' | 'all';

export interface CarryForwardEntitySummary {
  entity_type: AgendaEntityType;
  entity_id: number;
  entity_name: string;
}

export interface CarryForwardListItem {
  id: number;
  item_type: string;
  title: string;
  purpose_summary: string;
  current_status: string;
  current_status_label: string;
  owner: AgendaPersonSummary | null;
  next_review_on: string | null;
  next_review_label: string | null;
  privacy_level: string;
  linked_goal_id: number | null;
  report_due_on: string | null;
  report_due_label: string | null;
  support_needed: boolean;
  training_needed: boolean;
  decision_needed: boolean;
  latest_decision_summary: string | null;
  linked_evidence_summary: CarryForwardLinkedEvidenceSummary | null;
  latest_report_back_summary: string | null;
}

export interface CarryForwardReportResponseSummary {
  id: number;
  report_request_id: number;
  accomplishment_summary: string;
  evidence_summary: string | null;
  evidence_link: string | null;
  support_needed: boolean;
  training_needed: boolean;
  decision_needed: boolean;
  submitted_at: string;
  recommended_next_step: string | null;
}

export interface CarryForwardReportRequestSummary {
  id: number;
  requested_by_user_id: number | null;
  requested_from_user_id: number | null;
  requested_from: AgendaPersonSummary | null;
  due_on: string | null;
  due_label: string | null;
  prompt: string | null;
  expected_evidence_type: string | null;
  support_allowed: boolean;
  decision_expected: boolean;
  status: string;
  responded_at: string | null;
  latest_response_summary: string | null;
}

export interface CarryForwardDetailItem extends CarryForwardListItem {
  entity: CarryForwardEntitySummary;
  linked_sign_of_progress_id: number | null;
  linked_sign_action_id: number | null;
  can_manage: boolean;
  latest_report_response: {
    id: number;
    submitted_by: AgendaPersonSummary | null;
    submitted_at: string;
    accomplishment_summary: string;
    evidence_summary: string | null;
    evidence_link: string | null;
    support_needed: boolean;
    training_needed: boolean;
    decision_needed: boolean;
    recommended_next_step: string | null;
  } | null;
  report_requests: CarryForwardReportRequestSummary[];
}

export interface CarryForwardEntityListResponse {
  success: boolean;
  entity: CarryForwardEntitySummary;
  items: CarryForwardListItem[];
  meeting_surface: {
    auto_surface_count: number;
    report_back_due_count: number;
  };
  meta: {
    total: number;
  };
}

export interface CarryForwardItemResponse {
  success: boolean;
  item: CarryForwardDetailItem;
}

export interface CarryForwardUserSearchResult {
  id: number;
  name: string;
  label: string;
  ward_id: number | null;
}

export interface CarryForwardUserSearchResponse {
  success: boolean;
  users: CarryForwardUserSearchResult[];
}

export interface RequestCarryForwardReportPayload {
  itemId: number;
  requested_from_user_id: number;
  due_on?: string;
  prompt?: string;
  expected_evidence_type?: string;
  decision_expected?: boolean;
}

export interface RespondCarryForwardReportPayload {
  reportRequestId: number;
  accomplishment_summary: string;
  evidence_summary?: string;
  support_needed?: boolean;
  training_needed?: boolean;
  decision_needed?: boolean;
  recommended_next_step?: string;
}

export interface ResolveCarryForwardPayload {
  itemId: number;
  resolution_note?: string;
}

export interface DismissCarryForwardPayload {
  itemId: number;
  meeting_instance_key: string;
  reason?: string;
}

function invalidateCarryForwardQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['carry-forward-entity'], exact: false });
  queryClient.invalidateQueries({ queryKey: ['carry-forward-item'], exact: false });
  queryClient.invalidateQueries({ queryKey: ['agenda-my-items'], exact: false });
  queryClient.invalidateQueries({ queryKey: ['agenda-entity'], exact: false });
  queryClient.invalidateQueries({ queryKey: ['agenda-detail'], exact: false });
}

export function buildCarryForwardMeetingInstanceKey(
  entityType?: AgendaEntityType | string | null,
  entityId?: number | string | null,
  meetingDate?: string | null,
): string | null {
  if (!entityType || !entityId || !meetingDate) {
    return null;
  }

  return `${entityType}-${entityId}-${meetingDate}`;
}

export function useCarryForwardEntityList(
  entityType?: AgendaEntityType | null,
  entityId?: number | null,
  status: CarryForwardStatusFilter = 'open',
) {
  const { token } = useAuth();

  return useQuery<CarryForwardEntityListResponse>({
    queryKey: ['carry-forward-entity', entityType, entityId, status],
    queryFn: () =>
      authFetch(token, `/api/carry-forward/entities/${entityType}/${entityId}`, {
        params: {
          status,
        },
      }),
    enabled: !!token && !!entityType && !!entityId,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

export function useCarryForwardItem(itemId?: number | null) {
  const { token } = useAuth();

  return useQuery<CarryForwardItemResponse>({
    queryKey: ['carry-forward-item', itemId],
    queryFn: () => authFetch(token, `/api/carry-forward/items/${itemId}`),
    enabled: !!token && !!itemId,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

export function useCarryForwardUserSearch(query: string, wardId?: number | null) {
  const { token } = useAuth();
  const normalizedQuery = query.trim();

  return useQuery<CarryForwardUserSearchResponse>({
    queryKey: ['carry-forward-user-search', normalizedQuery, wardId ?? 'all'],
    queryFn: () =>
      authFetch(token, '/api/reference/users/search', {
        params: {
          q: normalizedQuery,
          ward_id: wardId ? String(wardId) : '',
        },
      }),
    enabled: !!token && normalizedQuery.length >= 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useRequestCarryForwardReport() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, RequestCarryForwardReportPayload>({
    mutationFn: ({ itemId, ...body }) =>
      authFetch(token, `/api/carry-forward/items/${itemId}/report-requests`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => invalidateCarryForwardQueries(queryClient),
  });
}

export function useRespondToCarryForwardReport() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; report_response: CarryForwardReportResponseSummary }, Error, RespondCarryForwardReportPayload>({
    mutationFn: ({ reportRequestId, ...body }) =>
      authFetch(token, `/api/carry-forward/report-requests/${reportRequestId}/responses`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => invalidateCarryForwardQueries(queryClient),
  });
}

export function useResolveCarryForwardItem() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, ResolveCarryForwardPayload>({
    mutationFn: ({ itemId, ...body }) =>
      authFetch(token, `/api/carry-forward/items/${itemId}/resolve`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => invalidateCarryForwardQueries(queryClient),
  });
}

export function useDismissCarryForwardItem() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, DismissCarryForwardPayload>({
    mutationFn: ({ itemId, ...body }) =>
      authFetch(token, `/api/carry-forward/items/${itemId}/dismiss`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => invalidateCarryForwardQueries(queryClient),
  });
}

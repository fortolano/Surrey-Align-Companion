import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';

// ─── Types ──────────────────────────────────────

export interface AgendaCouncil {
  id: number;
  name: string;
  slug: string;
}

export type AgendaEntityType = 'council' | 'committee' | 'organization';

export interface AgendaSubmissionTypeOption {
  value: string;
  label: string;
}

export interface AgendaSubmissionSectionOption {
  key: string;
  title: string;
  type: string;
  item_count: number;
  is_available: boolean;
}

export interface AgendaSubmissionDraftAgenda {
  id: number;
  title: string;
  meeting_date: string | null;
  meeting_date_label: string | null;
  meeting_time: string | null;
  status: string;
  sections: AgendaSubmissionSectionOption[];
}

export interface AgendaItemData {
  id: number;
  title: string;
  description: string | null;
  item_type: string;
  item_type_label: string;
  presenter_name: string | null;
  presenter_user_id: number | null;
  presenter_response: 'accepted' | 'declined' | null;
  presenter_responded_at: string | null;
  is_mine: boolean;
  duration_minutes: number | null;
  status: string | null;
  hymn_number: number | null;
  hymn_title: string | null;
  sort_order: number | null;
}

export interface AgendaSection {
  key: string;
  title: string;
  items: AgendaItemData[];
}

export interface AgendaSummary {
  id: number;
  title: string;
  meeting_date: string | null;
  meeting_date_label: string | null;
  meeting_time: string | null;
  location: string | null;
  status: string;
  is_upcoming: boolean;
  item_count: number;
  my_item_count: number;
  sections: AgendaSection[];
}

export interface AgendasResponse {
  success: boolean;
  council: AgendaCouncil;
  agendas: AgendaSummary[];
  can_submit: boolean;
  submission_item_types?: AgendaSubmissionTypeOption[];
  meta: { total: number };
}

export interface AgendaEntity {
  entity_type: AgendaEntityType;
  entity_id: number;
  entity_name: string;
  entity_kind: AgendaEntityType;
  council_slug?: string | null;
  can_submit: boolean;
  has_any_agenda?: boolean;
  submission_item_types?: AgendaSubmissionTypeOption[];
}

export interface AgendaSubmissionDestination {
  entity_type: AgendaEntityType;
  entity_id: number;
  entity_name: string;
  entity_kind: AgendaEntityType;
  council_slug?: string | null;
  can_submit: boolean;
  draft_count: number;
  next_draft_agenda_id: number | null;
  next_draft_agenda_title: string | null;
  next_draft_agenda_date: string | null;
  next_draft_agenda_date_label: string | null;
}

export interface AgendaEntityCard extends AgendaEntity {
  has_any_agenda: boolean;
  has_current_agenda: boolean;
  current_agenda_id: number | null;
  current_agenda_title: string | null;
  current_agenda_date: string | null;
  current_agenda_date_label: string | null;
  current_agenda_status: string | null;
  past_count: number;
  latest_past_agenda_id: number | null;
  latest_past_agenda_date: string | null;
  latest_past_agenda_date_label: string | null;
}

export interface AgendaSummaryListItem {
  id: number;
  title: string;
  meeting_date: string | null;
  meeting_date_label: string | null;
  meeting_time: string | null;
  location: string | null;
  status: string;
  item_count: number;
}

export interface AgendaEntitiesResponse {
  success: boolean;
  entities: AgendaEntityCard[];
  meta: { total: number };
}

export interface AgendaSubmissionDestinationsResponse {
  success: boolean;
  entities: AgendaSubmissionDestination[];
  meta: { total: number };
}

export interface AgendaEntityResponse {
  success: boolean;
  entity: AgendaEntity;
  current_agenda: AgendaSummaryListItem | null;
  past_agendas: AgendaSummaryListItem[];
  meta: { past_total: number; has_current: boolean };
}

export interface PublishedAgendaResponse {
  success: boolean;
  entity: AgendaEntity;
  agenda: AgendaSummary;
}

export interface AgendaSubmissionDestinationResponse {
  success: boolean;
  entity: AgendaEntity;
  draft_agendas: AgendaSubmissionDraftAgenda[];
  meta: { draft_total: number };
}

export interface AgendaSubmissionPayload {
  council_slug: string;
  title: string;
  item_type: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high';
  target_date?: string;
}

export interface AgendaSubmissionResponse {
  success: boolean;
  message: string;
  submission: {
    id: number;
    title: string;
    status: string;
    item_type?: string;
    item_type_label?: string;
    entity_type?: AgendaEntityType;
    entity_id?: number;
  };
}

export interface AgendaEntitySubmissionPayload {
  entityType: AgendaEntityType;
  entityId: number;
  title: string;
  agenda_id?: number;
  section_key?: string;
  item_type?: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high';
  target_date?: string;
}

export interface MyAgendaItem {
  id: number;
  title: string;
  item_type: string;
  item_type_label: string;
  duration_minutes: number | null;
  agenda_id: number | null;
  agenda_title: string | null;
  meeting_date: string | null;
  meeting_date_label: string | null;
  meeting_time: string | null;
  council_name: string | null;
  council_slug: string | null;
  entity_type: AgendaEntityType | null;
  entity_id: number | null;
  entity_name: string | null;
  agenda_web_url: string | null;
  presenter_response: 'accepted' | 'declined' | null;
  presenter_responded_at: string | null;
  days_until: number | null;
  time_label: string;
}

export interface MyAgendaItemsResponse {
  success: boolean;
  items: MyAgendaItem[];
  meta: { total: number };
}

export type AgendaResponseAction = 'accept' | 'decline';

export interface RespondToAgendaItemPayload {
  itemId: number;
  action: AgendaResponseAction;
}

export interface RespondToAgendaItemResponse {
  success: boolean;
  message: string;
  item: MyAgendaItem;
}

// ─── Hooks ──────────────────────────────────────

export function useCouncilAgendas(councilSlug: string) {
  const { token } = useAuth();

  return useQuery<AgendasResponse>({
    queryKey: ['/api/agendas', councilSlug],
    queryFn: () =>
      authFetch(token, '/api/agendas', {
        params: { council_slug: councilSlug },
      }),
    enabled: !!token && !!councilSlug,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
}

export function useMyAgendaItems() {
  const { token } = useAuth();

  return useQuery<MyAgendaItemsResponse>({
    queryKey: ['agenda-my-items'],
    queryFn: () => authFetch(token, '/api/agendas/my-items'),
    enabled: !!token,
    staleTime: 60000,
  });
}

export function useAgendaEntities(options?: { includeAll?: boolean }) {
  const { token } = useAuth();
  const includeAll = options?.includeAll === true;

  return useQuery<AgendaEntitiesResponse>({
    queryKey: ['agenda-entities', includeAll ? 'all' : 'active'],
    queryFn: () =>
      authFetch(token, '/api/agendas/entities', {
        params: includeAll ? { include_all: '1' } : undefined,
      }),
    enabled: !!token,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
}

export function useAgendaSubmissionDestinations() {
  const { token } = useAuth();

  return useQuery<AgendaSubmissionDestinationsResponse>({
    queryKey: ['agenda-submission-destinations'],
    queryFn: () => authFetch(token, '/api/agendas/submission-destinations'),
    enabled: !!token,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
}

export function useAgendaSubmissionDestination(entityType?: AgendaEntityType | null, entityId?: number | null) {
  const { token } = useAuth();

  return useQuery<AgendaSubmissionDestinationResponse>({
    queryKey: ['agenda-submission-destination', entityType, entityId],
    queryFn: () => authFetch(token, `/api/agendas/submission-destinations/${entityType}/${entityId}`),
    enabled: !!token && !!entityType && !!entityId,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
}

export function useAgendaEntity(entityType?: AgendaEntityType | null, entityId?: number | null) {
  const { token } = useAuth();

  return useQuery<AgendaEntityResponse>({
    queryKey: ['agenda-entity', entityType, entityId],
    queryFn: () => authFetch(token, `/api/agendas/entities/${entityType}/${entityId}`),
    enabled: !!token && !!entityType && !!entityId,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
}

export function usePublishedAgenda(agendaId?: number | null) {
  const { token } = useAuth();

  return useQuery<PublishedAgendaResponse>({
    queryKey: ['agenda-detail', agendaId],
    queryFn: () => authFetch(token, `/api/agendas/${agendaId}`),
    enabled: !!token && !!agendaId,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
}

export function useSubmitAgendaItem() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<AgendaSubmissionResponse, Error, AgendaSubmissionPayload>({
    mutationFn: (payload) =>
      authFetch(token, '/api/agendas/submissions', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/agendas', variables.council_slug] });
    },
  });
}

export function useSubmitEntityAgendaItem() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<AgendaSubmissionResponse, Error, AgendaEntitySubmissionPayload>({
    mutationFn: ({ entityType, entityId, ...payload }) =>
      authFetch(token, `/api/agendas/entities/${entityType}/${entityId}/submissions`, {
        method: 'POST',
        body: payload,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-entities'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-submission-destinations'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-entity', variables.entityType, variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ['agenda-submission-destination', variables.entityType, variables.entityId] });
    },
  });
}

export function useRespondToAgendaItem() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<RespondToAgendaItemResponse, Error, RespondToAgendaItemPayload>({
    mutationFn: ({ itemId, action }) =>
      authFetch(token, `/api/agendas/items/${itemId}/respond`, {
        method: 'POST',
        body: { action },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-my-items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
}

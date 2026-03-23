import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';

// ─── Types ──────────────────────────────────────

export interface AgendaCouncil {
  id: number;
  name: string;
  slug: string;
}

export interface AgendaItemData {
  id: number;
  title: string;
  description: string | null;
  item_type: string;
  item_type_label: string;
  presenter_name: string | null;
  presenter_user_id: number | null;
  is_mine: boolean;
  duration_minutes: number | null;
  status: string;
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
  meta: { total: number };
}

export interface AgendaSubmissionPayload {
  council_slug: string;
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high';
  target_date?: string;
}

export interface AgendaSubmissionResponse {
  success: boolean;
  message: string;
  submission: { id: number; title: string; status: string };
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
  days_until: number | null;
  time_label: string;
}

export interface MyAgendaItemsResponse {
  success: boolean;
  items: MyAgendaItem[];
  meta: { total: number };
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

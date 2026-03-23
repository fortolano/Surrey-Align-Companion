import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';

// ─── Types ──────────────────────────────────────

export interface PulseConfidenceDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface PulseTrend {
  prev_month_label: string;
  has_previous_data: boolean;
  high_delta: number;
  medium_delta: number;
  low_delta: number;
  prev_high: number;
  prev_medium: number;
  prev_low: number;
}

export interface PulseHealthLetter {
  letter: string;
  score: number;
  color: string;
}

export interface PulseAttentionItem {
  goal_id: number;
  goal_title: string;
  confidence: 'high' | 'medium' | 'low';
  organization: string | null;
  organization_id: number | null;
  council: string | null;
  council_id: number | null;
  user_name: string | null;
  support_types: string[] | null;
  support_note: string | null;
  stuck_months: number;
  health?: {
    overall_score: number;
    overall_color: string;
    letters: PulseHealthLetter[];
  };
  confidence_history?: Array<{
    month: number;
    year: number;
    confidence: string;
    month_label: string;
  }>;
}

export interface PulseWardRow {
  ward_name: string;
  goal_count: number;
  high: number;
  medium: number;
  low: number;
  support_count: number;
}

export interface PulseSupportRequest {
  type: string;
  count: number;
}

export interface PulseMissingOrg {
  id: number;
  name: string;
  ward: string | null;
}

export interface PulseReportResponse {
  success: boolean;
  month_label: string;
  date_label: string;
  cycle_id: number | null;
  check_in_month: number;
  check_in_year: number;
  submission_rate: number;
  confidence_distribution: PulseConfidenceDistribution;
  trend: PulseTrend;
  needs_attention: PulseAttentionItem[];
  by_ward: PulseWardRow[];
  support_requests: PulseSupportRequest[];
  missing_orgs: PulseMissingOrg[];
  meta: {
    total_check_ins: number;
    visible_org_count: number;
    missing_org_count: number;
  };
}

export interface PulseSubmitPayload {
  org_id?: number;
  council_id?: number;
  cycle_id: number;
  check_in_month: number;
  check_in_year: number;
  goals: Array<{ goal_id: number; confidence: 'high' | 'medium' | 'low' }>;
  support_types?: string[];
  support_note?: string;
}

export interface PulseSubmitResponse {
  success: boolean;
  created: number;
  skipped: number;
  rejected: number;
  message: string;
}

// ─── Hooks ──────────────────────────────────────

export function useAlignPulseReport(params?: {
  cycleId?: string;
  month?: string;
  year?: string;
}) {
  const { token } = useAuth();

  return useQuery<PulseReportResponse>({
    queryKey: ['align-pulse-report', params?.cycleId, params?.month, params?.year],
    queryFn: () =>
      authFetch(token, '/api/reports/align-pulse', {
        params: {
          ...(params?.cycleId ? { cycle_id: params.cycleId } : {}),
          ...(params?.month ? { month: params.month } : {}),
          ...(params?.year ? { year: params.year } : {}),
        },
      }),
    enabled: !!token,
    staleTime: 60000,
  });
}

export function useSubmitAlignPulse() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<PulseSubmitResponse, Error, PulseSubmitPayload>({
    mutationFn: (payload) =>
      authFetch(token, '/api/pulse', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['align-pulse-report'] });
    },
  });
}

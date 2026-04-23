import Colors from '@/constants/colors';

export interface LeadershipInsightAction {
  label: string;
  action_kind: string;
  params?: Record<string, unknown> | null;
  web_url?: string | null;
}

export interface LeadershipInsight {
  id: number;
  insight_key?: string | null;
  insight_type: string;
  category: string;
  severity: string;
  title: string;
  summary: string;
  current_surface_tier: string;
  lifecycle_state: string;
  scope_type?: string | null;
  scope_id?: number | null;
  detected_at?: string | null;
  first_surfaced_at?: string | null;
  last_surfaced_at?: string | null;
  deferred_until?: string | null;
  detail_url?: string | null;
  explain_payload?: Record<string, unknown> | null;
  linked_entity_refs?: Array<Record<string, unknown>> | null;
  primary_action?: LeadershipInsightAction | null;
  suggested_actions?: LeadershipInsightAction[] | null;
}

export interface LeadershipInsightInboxResponse {
  success: boolean;
  insights: LeadershipInsight[];
  meta?: {
    total?: number;
  };
}

export interface LeadershipInsightDetailResponse {
  success: boolean;
  insight: LeadershipInsight;
}

export interface LeadershipIntelligenceArtifact<TPayload = Record<string, unknown>> {
  artifact_id: number;
  title: string;
  kind: string;
  status_label: string;
  status_tone: string;
  generated_label: string;
  context_label?: string | null;
  summary_sentence?: string | null;
  primary_action_url?: string | null;
  primary_action_label?: string | null;
  payload: TPayload;
  source_summary?: Record<string, unknown> | unknown[];
  generated_at?: string | null;
  stale_at?: string | null;
}

export function leadershipArtifactTone(statusTone?: string | null): { backgroundColor: string; textColor: string } {
  switch (statusTone) {
    case 'success':
      return {
        backgroundColor: Colors.status.tealLight,
        textColor: Colors.status.teal,
      };
    case 'warning':
      return {
        backgroundColor: Colors.status.amberLight,
        textColor: Colors.status.amber,
      };
    case 'danger':
      return {
        backgroundColor: Colors.status.redLight,
        textColor: Colors.status.red,
      };
    default:
      return {
        backgroundColor: Colors.status.blueLight,
        textColor: Colors.status.blue,
      };
  }
}

export function uniqueLeadershipLines(lines: Array<string | null | undefined>, max = 3): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const line of lines) {
    const normalized = String(line ?? '').trim();
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    next.push(normalized);

    if (next.length >= max) {
      break;
    }
  }

  return next;
}

export function insightSeverityTone(severity?: string | null): { backgroundColor: string; textColor: string; label: string } {
  switch (severity) {
    case 'act_now':
      return { backgroundColor: Colors.status.redLight, textColor: Colors.status.red, label: 'Act now' };
    case 'act_soon':
      return { backgroundColor: Colors.status.amberLight, textColor: Colors.status.amber, label: 'Act soon' };
    case 'watch':
      return { backgroundColor: Colors.status.blueLight, textColor: Colors.status.blue, label: 'Watch' };
    default:
      return { backgroundColor: Colors.status.tealLight, textColor: Colors.status.teal, label: 'Info' };
  }
}

export function formatInsightTypeLabel(value?: string | null): string {
  return String(value ?? 'Insight')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

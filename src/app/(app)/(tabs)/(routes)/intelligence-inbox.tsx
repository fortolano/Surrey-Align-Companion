import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { appAlert } from '@/lib/platform-alert';
import { buildPathWithParams, getSingleParam } from '@/lib/navigation-return-target';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import {
  formatInsightTypeLabel,
  insightSeverityTone,
  type LeadershipInsight,
  type LeadershipInsightDetailResponse,
  type LeadershipInsightInboxResponse,
} from '@/lib/leadership-intelligence';
import AppButton from '@/components/ui/AppButton';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';
import AppStatusBadge from '@/components/ui/AppStatusBadge';
import AvatarMenu from '@/components/AvatarMenu';
import ScreenHeader from '@/components/ScreenHeader';

type DismissReason = 'not_relevant' | 'not_now' | 'already_handled' | 'wrong_info' | 'too_much';

const DISMISS_REASONS: { key: DismissReason; label: string }[] = [
  { key: 'not_now', label: 'Not now' },
  { key: 'already_handled', label: 'Handled' },
  { key: 'not_relevant', label: 'Not relevant' },
  { key: 'wrong_info', label: 'Wrong info' },
  { key: 'too_much', label: 'Too much' },
];

const queryKeys = {
  inbox: ['leadership-intelligence', 'inbox'] as const,
  detail: (id?: string | number | null) => ['leadership-intelligence', 'insight', String(id ?? '')] as const,
};

function formatTimeLabel(value?: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function evidenceLines(insight: LeadershipInsight): string[] {
  const explain = insight.explain_payload ?? {};
  const whyNow = explain['why_now'];
  const evidence = explain['evidence'];
  const nextStep = explain['next_step'];
  const evidenceItems = Array.isArray(evidence) ? evidence : [];

  return [whyNow, ...evidenceItems, nextStep]
    .filter((line): line is string => typeof line === 'string' && line.trim() !== '')
    .slice(0, 4);
}

function targetPathForAction(action: LeadershipInsight['primary_action']): string | null {
  if (!action) return null;

  const params = action.params ?? {};
  switch (action.action_kind) {
    case 'agenda.detail': {
      const agendaId = params.agenda_id ?? params.agendaId;
      return agendaId
        ? buildPathWithParams('/agenda-entity', { agendaId: String(agendaId), returnTo: '/intelligence-inbox' })
        : null;
    }
    case 'goal.detail': {
      const goalId = params.goal_id ?? params.goalId;
      return goalId
        ? buildPathWithParams('/goal-detail', { goalId: String(goalId), returnTo: '/intelligence-inbox' })
        : null;
    }
    case 'sacrament.overview':
      return buildPathWithParams('/sacrament-overview', {
        wardId: typeof params.ward_id === 'number' || typeof params.ward_id === 'string' ? params.ward_id : undefined,
        meetingDate: typeof params.meeting_date === 'string' ? params.meeting_date : undefined,
        returnTo: '/intelligence-inbox',
      });
    default:
      return null;
  }
}

function InsightRow({ insight, selected, onPress }: { insight: LeadershipInsight; selected: boolean; onPress: () => void }) {
  const tone = insightSeverityTone(insight.severity);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.insightRow, selected && styles.insightRowSelected, pressed && styles.pressed]}
      testID={`intelligence-row-${insight.id}`}
    >
      <View style={[styles.rowIcon, { backgroundColor: tone.backgroundColor }]}>
        <Ionicons name="bulb-outline" size={18} color={tone.textColor} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          <AppStatusBadge label={tone.label} backgroundColor={tone.backgroundColor} textColor={tone.textColor} />
          <Text style={styles.rowDate}>{formatTimeLabel(insight.first_surfaced_at ?? insight.detected_at)}</Text>
        </View>
        <Text style={styles.rowTitle} numberOfLines={2}>{insight.title}</Text>
        <Text style={styles.rowSummary} numberOfLines={2}>{insight.summary}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
    </Pressable>
  );
}

function EmptyState({ refetching, onRefresh }: { refetching: boolean; onRefresh: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="checkmark-circle-outline" size={26} color={Colors.status.teal} />
      </View>
      <Text style={styles.emptyTitle}>No active insights</Text>
      <Text style={styles.emptyCopy}>Nothing needs mobile attention right now.</Text>
      <AppButton label="Refresh" onPress={onRefresh} loading={refetching} variant="secondary" />
    </View>
  );
}

export default function IntelligenceInboxScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ insightId?: string | string[] }>();
  const routeInsightId = getSingleParam(params.insightId);
  const [selectedId, setSelectedId] = useState<string | null>(routeInsightId ?? null);
  const [showDismissReasons, setShowDismissReasons] = useState(false);

  const inboxQuery = useQuery<LeadershipInsightInboxResponse>({
    queryKey: queryKeys.inbox,
    queryFn: () => authFetch(token, '/api/leadership-intelligence/inbox'),
    enabled: !!token,
    staleTime: 30000,
  });

  const selectedFromList = useMemo(() => {
    const insights = inboxQuery.data?.insights ?? [];
    return insights.find((insight) => String(insight.id) === String(selectedId)) ?? insights[0] ?? null;
  }, [inboxQuery.data?.insights, selectedId]);

  useEffect(() => {
    if (routeInsightId) {
      setSelectedId(routeInsightId);
      return;
    }

    if (!selectedId && selectedFromList) {
      setSelectedId(String(selectedFromList.id));
    }
  }, [routeInsightId, selectedFromList, selectedId]);

  const detailQuery = useQuery<LeadershipInsightDetailResponse>({
    queryKey: queryKeys.detail(selectedId),
    queryFn: () => authFetch(token, `/api/leadership-intelligence/insights/${selectedId}`),
    enabled: !!token && !!selectedId,
    staleTime: 30000,
  });

  const selectedDetail = selectedId && String(detailQuery.data?.insight?.id) === String(selectedId)
    ? detailQuery.data.insight
    : null;
  const selectedInsight = selectedDetail ?? selectedFromList;
  const insights = inboxQuery.data?.insights ?? [];
  const refreshing = inboxQuery.isRefetching || detailQuery.isRefetching;

  const removeInsightFromCache = (insightId?: string | number | null) => {
    const normalizedId = String(insightId ?? '');
    if (!normalizedId) return;

    queryClient.removeQueries({ queryKey: queryKeys.detail(normalizedId) });

    queryClient.setQueryData<LeadershipInsightInboxResponse>(queryKeys.inbox, (current) => {
      if (!current) return current;

      const nextInsights = current.insights.filter((insight) => String(insight.id) !== normalizedId);

      return {
        ...current,
        insights: nextInsights,
        meta: current.meta ? { ...current.meta, total: nextInsights.length } : current.meta,
      };
    });
  };

  const invalidateInsight = (insightId?: string | number | null) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
    queryClient.invalidateQueries({ queryKey: queryKeys.detail(insightId) });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
  };

  const acceptMutation = useMutation({
    mutationFn: (insightId: number) => authFetch(token, `/api/leadership-intelligence/insights/${insightId}/accept`, { method: 'POST' }),
    onSuccess: (_data, insightId) => {
      removeInsightFromCache(insightId);
      invalidateInsight(insightId);
      setSelectedId(null);
      setShowDismissReasons(false);
    },
    onError: (error: any) => appAlert('Unable to accept insight', error?.message || 'Please try again.'),
  });

  const deferMutation = useMutation({
    mutationFn: (insightId: number) => authFetch(token, `/api/leadership-intelligence/insights/${insightId}/defer`, {
      method: 'POST',
      body: { defer_until: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
    }),
    onSuccess: (_data, insightId) => {
      removeInsightFromCache(insightId);
      invalidateInsight(insightId);
      setSelectedId(null);
      setShowDismissReasons(false);
    },
    onError: (error: any) => appAlert('Unable to defer insight', error?.message || 'Please try again.'),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ insightId, reason }: { insightId: number; reason: DismissReason }) => authFetch(
      token,
      `/api/leadership-intelligence/insights/${insightId}/dismiss`,
      { method: 'POST', body: { reason_code: reason } },
    ),
    onSuccess: (_data, variables) => {
      removeInsightFromCache(variables.insightId);
      invalidateInsight(variables.insightId);
      setSelectedId(null);
      setShowDismissReasons(false);
    },
    onError: (error: any) => appAlert('Unable to dismiss insight', error?.message || 'Please try again.'),
  });

  const isMutating = acceptMutation.isPending || deferMutation.isPending || dismissMutation.isPending;
  const evidence = selectedInsight ? evidenceLines(selectedInsight) : [];
  const selectedTone = selectedInsight ? insightSeverityTone(selectedInsight.severity) : null;
  const selectedAction = selectedInsight?.primary_action ?? selectedInsight?.suggested_actions?.[0] ?? null;
  const selectedActionPath = targetPathForAction(selectedAction);
  const bottomPadding = insets.bottom + WEB_BOTTOM_INSET + 24;

  const refreshAll = () => {
    triggerGlobalRefreshIndicator();
    inboxQuery.refetch();
    detailQuery.refetch();
  };

  const openPrimaryAction = async () => {
    if (!selectedAction) return;

    if (selectedActionPath) {
      router.push(selectedActionPath as any);
      return;
    }

    if (selectedAction.web_url) {
      await Linking.openURL(selectedAction.web_url);
    }
  };

  return (
    <View style={styles.screen} testID="intelligence-inbox-screen">
      <ScreenHeader title="Leadership Intelligence" subtitle="Signals that may need leader attention" rightElement={<AvatarMenu />} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={Colors.brand.primary} />}
      >
        {inboxQuery.isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.brand.primary} />
            <Text style={styles.loadingText}>Loading insights...</Text>
          </View>
        ) : inboxQuery.isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Insights could not load</Text>
            <Text style={styles.emptyCopy}>Pull to refresh or try again in a moment.</Text>
            <AppButton label="Try again" onPress={refreshAll} variant="secondary" />
          </View>
        ) : insights.length === 0 ? (
          <EmptyState refetching={refreshing} onRefresh={refreshAll} />
        ) : (
          <>
            <View style={styles.summaryBand}>
              <View>
                <Text style={styles.summaryNumber}>{insights.length}</Text>
                <Text style={styles.summaryLabel}>active insight{insights.length === 1 ? '' : 's'}</Text>
              </View>
              <Text style={styles.summaryCopy}>Review what matters, then accept, defer, or dismiss it so the signal learns.</Text>
            </View>

            <View style={styles.listPanel}>
              {insights.map((insight) => (
                <InsightRow
                  key={insight.id}
                  insight={insight}
                  selected={String(selectedInsight?.id ?? selectedId) === String(insight.id)}
                  onPress={() => {
                    setSelectedId(String(insight.id));
                    setShowDismissReasons(false);
                  }}
                />
              ))}
            </View>

            {selectedInsight ? (
              <View style={styles.detailCard} testID="intelligence-detail-card">
                <View style={styles.detailHeader}>
                  <View style={styles.detailTitleBlock}>
                    <Text style={styles.detailEyebrow}>{formatInsightTypeLabel(selectedInsight.insight_type)}</Text>
                    <Text style={styles.detailTitle}>{selectedInsight.title}</Text>
                  </View>
                  {selectedTone ? (
                    <AppStatusBadge label={selectedTone.label} backgroundColor={selectedTone.backgroundColor} textColor={selectedTone.textColor} />
                  ) : null}
                </View>
                <Text style={styles.detailSummary}>{selectedInsight.summary}</Text>

                {evidence.length > 0 ? (
                  <View style={styles.evidenceBlock}>
                    <Text style={styles.sectionLabel}>Why now</Text>
                    {evidence.map((line) => (
                      <View key={line} style={styles.evidenceRow}>
                        <View style={styles.evidenceDot} />
                        <Text style={styles.evidenceText}>{line}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {selectedAction ? (
                  <AppButton label={selectedAction.label || 'Open related work'} onPress={openPrimaryAction} variant="secondary" />
                ) : null}

                <View style={styles.actionGrid}>
                  <AppButton
                    label="Accept"
                    onPress={() => acceptMutation.mutate(selectedInsight.id)}
                    loading={acceptMutation.isPending}
                    disabled={isMutating}
                    style={styles.actionButton}
                  />
                  <AppButton
                    label="Defer"
                    onPress={() => deferMutation.mutate(selectedInsight.id)}
                    loading={deferMutation.isPending}
                    disabled={isMutating}
                    variant="secondary"
                    style={styles.actionButton}
                  />
                </View>

                <Pressable
                  onPress={() => setShowDismissReasons((value) => !value)}
                  style={({ pressed }) => [styles.dismissToggle, pressed && styles.pressed]}
                  accessibilityRole="button"
                  testID="intelligence-dismiss-toggle"
                >
                  <Ionicons name="close-circle-outline" size={18} color={Colors.brand.darkGray} />
                  <Text style={styles.dismissToggleText}>Dismiss with reason</Text>
                  <Ionicons name={showDismissReasons ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.brand.midGray} />
                </Pressable>

                {showDismissReasons ? (
                  <AppSegmentedControl
                    items={DISMISS_REASONS}
                    activeKey=""
                    onChange={(reason) => dismissMutation.mutate({ insightId: selectedInsight.id, reason: reason as DismissReason })}
                    testIDPrefix="intelligence-dismiss-reason"
                  />
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  loadingState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  summaryBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: Colors.brand.cardBg,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  summaryNumber: {
    fontSize: 32,
    lineHeight: 36,
    fontFamily: 'Inter_700Bold',
    color: Colors.brand.primary,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.brand.midGray,
  },
  summaryCopy: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    color: Colors.brand.darkGray,
  },
  listPanel: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.brand.cardBg,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  insightRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brand.lightGray,
  },
  insightRowSelected: {
    backgroundColor: Colors.brand.accentWarm,
  },
  pressed: {
    opacity: 0.84,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowDate: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 21,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  rowSummary: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  detailCard: {
    gap: 14,
    padding: 16,
    borderRadius: 8,
    backgroundColor: Colors.brand.cardBg,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailTitleBlock: {
    flex: 1,
    gap: 4,
  },
  detailEyebrow: {
    fontSize: 12,
    letterSpacing: 0,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
    color: Colors.brand.primary,
  },
  detailTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontFamily: 'Inter_700Bold',
    color: Colors.brand.dark,
  },
  detailSummary: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    color: Colors.brand.darkGray,
  },
  evidenceBlock: {
    gap: 9,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.brand.offWhite,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.brand.dark,
  },
  evidenceRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  evidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: Colors.brand.primary,
  },
  evidenceText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    color: Colors.brand.darkGray,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  dismissToggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.brand.offWhite,
  },
  dismissToggleText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.brand.darkGray,
  },
  emptyState: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    borderRadius: 8,
    backgroundColor: Colors.brand.cardBg,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.tealLight,
  },
  emptyTitle: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    color: Colors.brand.dark,
  },
  emptyCopy: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    color: Colors.brand.midGray,
  },
});

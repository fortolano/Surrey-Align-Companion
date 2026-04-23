import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { ApiResponseError, authFetch } from '@/lib/api';
import { buildPathWithParams, withReturnTarget } from '@/lib/navigation-return-target';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import AvatarMenu from '@/components/AvatarMenu';
import PreparedLeadershipCard from '@/components/PreparedLeadershipCard';
import ScreenHeader from '@/components/ScreenHeader';
import AppButton from '@/components/ui/AppButton';
import AppPickerTrigger from '@/components/ui/AppPickerTrigger';
import AppStatusBadge from '@/components/ui/AppStatusBadge';
import type { LeadershipIntelligenceArtifact } from '@/lib/leadership-intelligence';
import { uniqueLeadershipLines } from '@/lib/leadership-intelligence';

type BishopHomeMode = 'home-tab' | 'route';
type BishopHomeCardKey = 'sacrament_meeting' | 'calling_requests' | 'sunday_business' | 'my_work';

interface BishopHomeScreenProps {
  mode: BishopHomeMode;
  fallback?: React.ReactNode;
}

interface WardOption {
  id: number;
  name: string;
  selected: boolean;
}

interface WeekNavigation {
  previous_week_start: string;
  current_week_start: string;
  next_week_start: string;
  is_current_week: boolean;
  previous_week_label: string;
  current_week_label: string;
  next_week_label: string;
}

interface CommandCenterWeek {
  week_start: string;
  week_end: string;
  week_label: string;
  sunday_date: string;
  sunday_label: string;
}

interface CommandCenterHeadline {
  attention_now_count: number;
  this_week_count: number;
  before_sunday_count: number;
  calling_and_business_count: number;
  my_work_attention_count: number;
  summary: string;
}

interface CardTopItem {
  label: string;
  meta?: string | null;
  detail?: string | null;
}

interface CommandCenterCard {
  meeting_id?: number | null;
  date?: string | null;
  date_label?: string | null;
  status?: string | null;
  status_label?: string | null;
  needs_attention?: boolean;
  has_meeting?: boolean;
  state?: string | null;
  state_label?: string | null;
  readiness_label?: string | null;
  readiness_percent?: number | null;
  missing_leadership_count?: number | null;
  open_speaker_count?: number | null;
  next_action?: string | null;
  summary?: string | null;
  top_gaps?: string[];
  top_items?: CardTopItem[];
  pending_action_count?: number | null;
  recent_count?: number | null;
  open_count?: number | null;
  in_progress_count?: number | null;
  outstanding_count?: number | null;
  ready_count?: number | null;
  active_group_count?: number | null;
  waiting_group_count?: number | null;
  count?: number | null;
  attention_now_count?: number | null;
  this_week_count?: number | null;
  overdue_count?: number | null;
  decision_count?: number | null;
  pulse_due_count?: number | null;
}

interface LeadershipDailyBriefPayload {
  role_focus?: string;
  opening_question?: string;
  focus_items?: {
    title?: string;
    suggestion?: string;
    reason?: string;
  }[];
  watch_items?: {
    title?: string;
    signal?: string;
    why?: string;
  }[];
}

interface LeadershipActionBundlePayload {
  summary_sentence?: string;
  opening_question?: string;
  encouragement?: string;
  actions?: {
    title?: string;
    why_now?: string;
    next_step?: string;
  }[];
  watch_items?: {
    title?: string;
    detail?: string;
    timing?: string;
  }[];
}

interface BishopHomeResponse {
  success: boolean;
  command_center: {
    scope: string;
    available_wards: WardOption[];
    ward: {
      id: number;
      name: string;
    };
    week: CommandCenterWeek;
    navigation: WeekNavigation;
    headline: CommandCenterHeadline;
    cards: Record<BishopHomeCardKey, CommandCenterCard>;
    leadership_intelligence?: {
      daily_brief?: LeadershipIntelligenceArtifact<LeadershipDailyBriefPayload> | null;
      prepared_next_moves?: LeadershipIntelligenceArtifact<LeadershipActionBundlePayload> | null;
    };
  };
  meta?: {
    generated_at?: string;
  };
}

interface CardMetric {
  label: string;
  value: string;
}

interface CardBadgeTone {
  label: string;
  backgroundColor: string;
  textColor: string;
}

interface CardConfig {
  title: string;
  route: string;
  openLabel: string;
  icon: string;
  iconSet: 'ionicons' | 'mci' | 'feather';
  iconColor: string;
  iconBg: string;
}

const CARD_ORDER: BishopHomeCardKey[] = [
  'sacrament_meeting',
  'calling_requests',
  'sunday_business',
  'my_work',
];

const CARD_CONFIG: Record<BishopHomeCardKey, CardConfig> = {
  sacrament_meeting: {
    title: 'Sacrament Meeting',
    route: '/sacrament-overview',
    openLabel: 'Open sacrament overview',
    icon: 'calendar-clear-outline',
    iconSet: 'ionicons',
    iconColor: Colors.brand.primary,
    iconBg: '#E8F4F8',
  },
  calling_requests: {
    title: 'Calling Requests',
    route: '/callings',
    openLabel: 'Open calling requests',
    icon: 'people-outline',
    iconSet: 'ionicons',
    iconColor: Colors.brand.primary,
    iconBg: '#E8F4F8',
  },
  sunday_business: {
    title: 'Sunday Business',
    route: '/sunday-business',
    openLabel: 'Open Sunday business',
    icon: 'script-text-outline',
    iconSet: 'mci',
    iconColor: Colors.brand.primary,
    iconBg: '#E8F4F8',
  },
  my_work: {
    title: 'My Work',
    route: '/assignments',
    openLabel: 'Open my work',
    icon: 'check-square',
    iconSet: 'feather',
    iconColor: Colors.brand.primary,
    iconBg: '#F3E8FF',
  },
};

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  if (Array.isArray(value)) {
    return firstString(value[0]);
  }

  return undefined;
}

function isEligibleForBishopHome(user: ReturnType<typeof useAuth>['user']): boolean {
  return user?.is_bishop === true || user?.is_executive_secretary === true;
}

function formatGeneratedAt(value?: string | null): string {
  if (!value) return 'Updated just now';

  try {
    return `Updated ${new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  } catch {
    return 'Updated just now';
  }
}

function renderCardIcon(config: CardConfig) {
  if (config.iconSet === 'mci') {
    return <MaterialCommunityIcons name={config.icon as any} size={20} color={config.iconColor} />;
  }

  if (config.iconSet === 'feather') {
    return <Feather name={config.icon as any} size={18} color={config.iconColor} />;
  }

  return <Ionicons name={config.icon as any} size={20} color={config.iconColor} />;
}

function buildCardMetrics(cardKey: BishopHomeCardKey, card: CommandCenterCard): CardMetric[] {
  if (cardKey === 'sacrament_meeting') {
    return [
      {
        label: 'Readiness',
        value: card.readiness_label ?? 'Not started',
      },
      {
        label: 'Leadership',
        value: card.missing_leadership_count && card.missing_leadership_count > 0
          ? `${card.missing_leadership_count} open`
          : 'Ready',
      },
      {
        label: 'Speakers',
        value: typeof card.open_speaker_count === 'number'
          ? (card.open_speaker_count > 0 ? `${card.open_speaker_count} open` : 'Ready')
          : 'Review',
      },
    ];
  }

  if (cardKey === 'calling_requests') {
    return [
      {
        label: 'Need action',
        value: String(card.pending_action_count ?? 0),
      },
      {
        label: 'Open',
        value: String(card.open_count ?? 0),
      },
      {
        label: 'In progress',
        value: String(card.in_progress_count ?? 0),
      },
    ];
  }

  if (cardKey === 'sunday_business') {
    return [
      {
        label: 'Outstanding',
        value: String(card.outstanding_count ?? 0),
      },
      {
        label: 'Ready',
        value: String(card.ready_count ?? 0),
      },
      {
        label: 'Active groups',
        value: String(card.active_group_count ?? 0),
      },
    ];
  }

  return [
    {
      label: 'Attention now',
      value: String(card.attention_now_count ?? 0),
    },
    {
      label: 'This week',
      value: String(card.this_week_count ?? 0),
    },
    {
      label: 'Overdue',
      value: String(card.overdue_count ?? 0),
    },
  ];
}

function buildCardBadge(card: CommandCenterCard): CardBadgeTone {
  const needsAttention = card.needs_attention
    || (card.pending_action_count ?? 0) > 0
    || (card.outstanding_count ?? 0) > 0
    || (card.attention_now_count ?? 0) > 0;

  if (needsAttention) {
    return {
      label: card.status_label ?? card.state_label ?? 'Needs attention',
      backgroundColor: '#FEF3C7',
      textColor: '#92400E',
    };
  }

  if (card.status_label || card.state_label) {
    return {
      label: card.status_label ?? card.state_label ?? 'On track',
      backgroundColor: '#D1FAE5',
      textColor: '#065F46',
    };
  }

  return {
    label: 'Review',
    backgroundColor: '#DBEAFE',
    textColor: '#1E40AF',
  };
}

function buildHighlights(card: CommandCenterCard): CardTopItem[] {
  if (Array.isArray(card.top_items) && card.top_items.length > 0) {
    return card.top_items.slice(0, 2);
  }

  if (Array.isArray(card.top_gaps) && card.top_gaps.length > 0) {
    return card.top_gaps.slice(0, 2).map((gap) => ({
      label: gap,
      meta: 'Gap',
    }));
  }

  if (card.next_action) {
    return [
      {
        label: card.next_action,
        meta: 'Next',
      },
    ];
  }

  return [];
}

function buildDailyBriefBullets(artifact?: LeadershipIntelligenceArtifact<LeadershipDailyBriefPayload> | null): string[] {
  const payload = artifact?.payload;
  if (!payload) return [];

  const focusItems = Array.isArray(payload.focus_items) ? payload.focus_items : [];
  const watchItems = Array.isArray(payload.watch_items) ? payload.watch_items : [];

  return uniqueLeadershipLines([
    ...focusItems.flatMap((item) => [item.title, item.suggestion, item.reason]),
    ...watchItems.flatMap((item) => [item.title, item.signal, item.why]),
  ], 3);
}

function buildActionBundleBullets(artifact?: LeadershipIntelligenceArtifact<LeadershipActionBundlePayload> | null): string[] {
  const payload = artifact?.payload;
  if (!payload) return [];

  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const watchItems = Array.isArray(payload.watch_items) ? payload.watch_items : [];

  return uniqueLeadershipLines([
    ...actions.flatMap((item) => [item.title, item.why_now, item.next_step]),
    ...watchItems.flatMap((item) => [item.title, item.detail, item.timing]),
  ], 3);
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.stateCard}>
      <Ionicons name={icon} size={28} color={Colors.brand.midGray} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
    </View>
  );
}

export default function BishopHomeScreen({ mode, fallback }: BishopHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ wardId?: string | string[]; weekStart?: string | string[] }>();
  const [wardPickerOpen, setWardPickerOpen] = useState(false);
  const eligible = isEligibleForBishopHome(user);
  const firstName = user?.name?.split(' ')[0] || 'Leader';
  const webBottomInset = WEB_BOTTOM_INSET;

  const requestedWardId = useMemo(() => {
    const parsed = Number(firstString(params.wardId));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [params.wardId]);

  const requestedWeekStart = useMemo(() => firstString(params.weekStart) ?? null, [params.weekStart]);

  const [selectedWardId, setSelectedWardId] = useState<number | null>(requestedWardId);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(requestedWeekStart);

  useEffect(() => {
    if (mode !== 'route') return;
    setSelectedWardId(requestedWardId);
  }, [mode, requestedWardId]);

  useEffect(() => {
    if (mode !== 'route') return;
    setSelectedWeekStart(requestedWeekStart);
  }, [mode, requestedWeekStart]);

  const syncSelection = useCallback((nextWardId: number | null, nextWeekStart: string | null) => {
    setSelectedWardId(nextWardId);
    setSelectedWeekStart(nextWeekStart);

    if (mode !== 'route') {
      return;
    }

    router.replace({
      pathname: '/bishop-home',
      params: {
        ...(nextWardId ? { wardId: String(nextWardId) } : {}),
        ...(nextWeekStart ? { weekStart: nextWeekStart } : {}),
      },
    } as any);
  }, [mode]);

  const bishopHomeQuery = useQuery<BishopHomeResponse>({
    queryKey: ['/api/command-centers/bishop', selectedWardId ?? 'default', selectedWeekStart ?? 'current'],
    queryFn: () => authFetch(token, '/api/command-centers/bishop', {
      params: {
        ...(selectedWardId ? { wardId: String(selectedWardId) } : {}),
        ...(selectedWeekStart ? { weekStart: selectedWeekStart } : {}),
      },
    }),
    enabled: !!token && eligible,
    staleTime: 60000,
  });

  const commandCenter = bishopHomeQuery.data?.command_center;
  const error = bishopHomeQuery.error;
  const isPermissionDenied = error instanceof ApiResponseError && error.status === 403;
  const availableWards = commandCenter?.available_wards ?? [];
  const activeWardId = commandCenter?.ward.id ?? selectedWardId ?? user?.ward_id ?? null;
  const activeWeekStart = commandCenter?.week.week_start ?? selectedWeekStart ?? null;
  const leadershipIntelligence = commandCenter?.leadership_intelligence;
  const dailyBrief = leadershipIntelligence?.daily_brief ?? null;
  const preparedNextMoves = leadershipIntelligence?.prepared_next_moves ?? null;
  const preparedCount = [dailyBrief, preparedNextMoves].filter(Boolean).length;
  const returnTarget = mode === 'route'
    ? buildPathWithParams('/bishop-home', {
      wardId: activeWardId ?? undefined,
      weekStart: activeWeekStart ?? undefined,
    })
    : '/';

  const onRefresh = useCallback(async () => {
    await bishopHomeQuery.refetch();
    triggerGlobalRefreshIndicator();
  }, [bishopHomeQuery]);

  const openCard = useCallback((cardKey: BishopHomeCardKey, card: CommandCenterCard) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (cardKey === 'sacrament_meeting') {
      router.push(withReturnTarget('/sacrament-overview', returnTarget, {
        wardId: activeWardId ?? undefined,
        meetingDate: card.date ?? undefined,
      }));
      return;
    }

    router.push(withReturnTarget(CARD_CONFIG[cardKey].route, returnTarget));
  }, [activeWardId, returnTarget]);

  if (mode === 'home-tab' && isPermissionDenied && fallback) {
    return <>{fallback}</>;
  }

  if (!eligible || isPermissionDenied) {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            styles.centeredScrollContent,
            { paddingTop: mode === 'home-tab' ? 20 : 28, paddingBottom: insets.bottom + webBottomInset + 28 },
          ]}
        >
          <EmptyState
            icon="lock-closed-outline"
            title="Bishop Home is limited to bishops and executive secretaries"
            body="This mobile home keeps the weekly bishop coordination view support-oriented and does not widen access for other roles."
          />
        </ScrollView>
      </View>
    );
  }

  const body = (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollContent, { paddingTop: 20, paddingBottom: insets.bottom + webBottomInset + 28 }]}
      refreshControl={
        <RefreshControl
          refreshing={bishopHomeQuery.isRefetching}
          onRefresh={onRefresh}
          tintColor={Colors.brand.primary}
          colors={[Colors.brand.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
      testID={mode === 'home-tab' ? 'bishop-home-tab-screen' : 'bishop-home-route-screen'}
    >
      {bishopHomeQuery.isLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
          <Text style={styles.loadingText}>Loading this week&apos;s bishop home…</Text>
        </View>
      ) : bishopHomeQuery.isError || !commandCenter ? (
        <View style={styles.sectionCard}>
          <Text style={styles.errorTitle}>Bishop Home could not be loaded</Text>
          <Text style={styles.errorBody}>
            {error instanceof Error
              ? error.message
              : 'The weekly command-center summary is unavailable right now.'}
          </Text>
          <AppButton label="Try again" onPress={() => void bishopHomeQuery.refetch()} style={styles.retryButton} />
        </View>
      ) : (
        <>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Weekly coordination home</Text>
            <Text style={styles.heroTitle}>Bishop Home</Text>
            <Text style={styles.heroBody}>
              {commandCenter.headline.summary || 'Use this page as the quick read before you open the owning tools.'}
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaChip}>
                <Ionicons name="home-outline" size={14} color={Colors.brand.white} />
                <Text style={styles.heroMetaText}>{commandCenter.ward.name}</Text>
              </View>
              <View style={styles.heroMetaChip}>
                <Ionicons name="calendar-outline" size={14} color={Colors.brand.white} />
                <Text style={styles.heroMetaText}>{commandCenter.week.week_label}</Text>
              </View>
            </View>
            <View style={styles.heroMetricRow}>
              <View style={styles.heroMetric}>
                <Text style={styles.heroMetricValue}>{commandCenter.headline.attention_now_count}</Text>
                <Text style={styles.heroMetricLabel}>attention now</Text>
              </View>
              <View style={styles.heroMetric}>
                <Text style={styles.heroMetricValue}>{commandCenter.headline.before_sunday_count}</Text>
                <Text style={styles.heroMetricLabel}>before Sunday</Text>
              </View>
              <View style={styles.heroMetric}>
                <Text style={styles.heroMetricValue}>{commandCenter.headline.my_work_attention_count}</Text>
                <Text style={styles.heroMetricLabel}>personal queue</Text>
              </View>
            </View>
            <Text style={styles.generatedAt}>{formatGeneratedAt(bishopHomeQuery.data?.meta?.generated_at)}</Text>
          </View>

          {preparedCount > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Prepared for you</Text>
                <Text style={styles.sectionMeta}>{preparedCount} ready</Text>
              </View>

              <View style={styles.preparedCardList}>
                {dailyBrief ? (
                  <PreparedLeadershipCard
                    eyebrow={dailyBrief.context_label ?? 'Daily brief'}
                    title={dailyBrief.title}
                    summary={dailyBrief.summary_sentence || dailyBrief.payload.role_focus || 'Today already has a clear leadership focus.'}
                    question={dailyBrief.payload.opening_question}
                    bullets={buildDailyBriefBullets(dailyBrief)}
                    generatedLabel={dailyBrief.generated_label}
                    statusLabel={dailyBrief.status_label}
                    statusTone={dailyBrief.status_tone}
                    icon="sunny-outline"
                    testID="bishop-home-daily-brief-card"
                  />
                ) : null}

                {preparedNextMoves ? (
                  <PreparedLeadershipCard
                    eyebrow={preparedNextMoves.context_label ?? 'Prepared next moves'}
                    title={preparedNextMoves.title}
                    summary={preparedNextMoves.summary_sentence || preparedNextMoves.payload.summary_sentence || 'One prepared next move already deserves first attention.'}
                    question={preparedNextMoves.payload.opening_question}
                    focus={preparedNextMoves.payload.encouragement}
                    bullets={buildActionBundleBullets(preparedNextMoves)}
                    generatedLabel={preparedNextMoves.generated_label}
                    statusLabel={preparedNextMoves.status_label}
                    statusTone={preparedNextMoves.status_tone}
                    actionLabel="Open My Work"
                    onAction={() => router.push(withReturnTarget('/assignments', returnTarget))}
                    icon="checkmark-done-outline"
                    testID="bishop-home-action-bundle-card"
                  />
                ) : null}
              </View>
            </>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Scope and timing</Text>
            {availableWards.length > 1 ? (
              <View style={styles.controlBlock}>
                <Text style={styles.controlLabel}>Ward</Text>
                <AppPickerTrigger
                  label={commandCenter.ward.name}
                  onPress={() => setWardPickerOpen(true)}
                  style={styles.pickerTrigger}
                />
              </View>
            ) : (
              <View style={styles.lockedScopeRow}>
                <Ionicons name="home-outline" size={16} color={Colors.brand.primary} />
                <Text style={styles.lockedScopeText}>{commandCenter.ward.name}</Text>
              </View>
            )}

            <View style={styles.controlBlock}>
              <Text style={styles.controlLabel}>Selected week</Text>
              <Text style={styles.currentWeekLabel}>{commandCenter.week.week_label}</Text>
              <Text style={styles.currentWeekMeta}>Sunday {commandCenter.week.sunday_label}</Text>
            </View>

            <View style={styles.weekNavStack}>
              <Pressable
                onPress={() => syncSelection(activeWardId, commandCenter.navigation.previous_week_start)}
                style={({ pressed }) => [styles.weekNavButton, pressed && styles.weekNavButtonPressed]}
                testID="bishop-home-week-previous"
              >
                <View>
                  <Text style={styles.weekNavTitle}>Previous week</Text>
                  <Text style={styles.weekNavSubtitle}>{commandCenter.navigation.previous_week_label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} style={styles.weekNavChevronLeft} />
              </Pressable>

              <Pressable
                onPress={() => syncSelection(activeWardId, commandCenter.navigation.current_week_start)}
                style={({ pressed }) => [
                  styles.weekNavButton,
                  commandCenter.navigation.is_current_week && styles.weekNavButtonActive,
                  pressed && styles.weekNavButtonPressed,
                ]}
                testID="bishop-home-week-current"
              >
                <View>
                  <Text style={styles.weekNavTitle}>Current week</Text>
                  <Text style={styles.weekNavSubtitle}>{commandCenter.navigation.current_week_label}</Text>
                </View>
                <AppStatusBadge
                  label={commandCenter.navigation.is_current_week ? 'Current' : 'Jump now'}
                  backgroundColor={commandCenter.navigation.is_current_week ? '#D1FAE5' : '#DBEAFE'}
                  textColor={commandCenter.navigation.is_current_week ? '#065F46' : '#1E40AF'}
                />
              </Pressable>

              <Pressable
                onPress={() => syncSelection(activeWardId, commandCenter.navigation.next_week_start)}
                style={({ pressed }) => [styles.weekNavButton, pressed && styles.weekNavButtonPressed]}
                testID="bishop-home-week-next"
              >
                <View>
                  <Text style={styles.weekNavTitle}>Next week</Text>
                  <Text style={styles.weekNavSubtitle}>{commandCenter.navigation.next_week_label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This week&apos;s source tools</Text>
            <Text style={styles.sectionMeta}>4 summaries</Text>
          </View>

          <View style={styles.cardList}>
            {CARD_ORDER.map((cardKey) => {
              const card = commandCenter.cards[cardKey];
              const config = CARD_CONFIG[cardKey];
              const metrics = buildCardMetrics(cardKey, card);
              const badge = buildCardBadge(card);
              const highlights = buildHighlights(card);

              return (
                <Pressable
                  key={cardKey}
                  onPress={() => openCard(cardKey, card)}
                  style={({ pressed }) => [
                    styles.summaryCard,
                    pressed && styles.summaryCardPressed,
                  ]}
                  testID={`bishop-home-card-${cardKey}`}
                >
                  <View style={styles.summaryCardHeader}>
                    <View style={styles.summaryCardTitleRow}>
                      <View style={[styles.summaryCardIcon, { backgroundColor: config.iconBg }]}>
                        {renderCardIcon(config)}
                      </View>
                      <View style={styles.summaryCardTitleBlock}>
                        <Text style={styles.summaryCardTitle}>{config.title}</Text>
                        <Text style={styles.summaryCardSummary} numberOfLines={3}>
                          {card.summary ?? card.next_action ?? 'Open the source tool for details.'}
                        </Text>
                      </View>
                    </View>
                    <AppStatusBadge
                      label={badge.label}
                      backgroundColor={badge.backgroundColor}
                      textColor={badge.textColor}
                      style={styles.summaryCardBadge}
                    />
                  </View>

                  <View style={styles.metricPillRow}>
                    {metrics.map((metric) => (
                      <View key={`${cardKey}-${metric.label}`} style={styles.metricPill}>
                        <Text style={styles.metricPillValue}>{metric.value}</Text>
                        <Text style={styles.metricPillLabel}>{metric.label}</Text>
                      </View>
                    ))}
                  </View>

                  {highlights.length > 0 ? (
                    <View style={styles.highlightList}>
                      {highlights.map((item, index) => (
                        <View key={`${cardKey}-${item.label}-${index}`} style={styles.highlightRow}>
                          <Ionicons name="ellipse" size={8} color={Colors.brand.primary} />
                          <View style={styles.highlightBody}>
                            <Text style={styles.highlightLabel} numberOfLines={1}>{item.label}</Text>
                            {item.meta ? <Text style={styles.highlightMeta}>{item.meta}</Text> : null}
                            {item.detail ? (
                              <Text style={styles.highlightDetail} numberOfLines={2}>{item.detail}</Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.summaryCardFooter}>
                    <Text style={styles.summaryCardFooterText}>{config.openLabel}</Text>
                    <Ionicons name="chevron-forward" size={18} color={Colors.brand.primary} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={wardPickerOpen}
        onRequestClose={() => setWardPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setWardPickerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Choose ward</Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {availableWards.map((ward) => {
                const selected = ward.id === activeWardId;
                return (
                  <Pressable
                    key={ward.id}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.selectionAsync();
                      }
                      syncSelection(ward.id, activeWeekStart);
                      setWardPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.modalOption,
                      selected && styles.modalOptionSelected,
                      pressed && styles.modalOptionPressed,
                    ]}
                  >
                    <Text style={[styles.modalOptionText, selected && styles.modalOptionTextSelected]}>
                      {ward.name}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={Colors.brand.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <AppButton label="Close" variant="secondary" onPress={() => setWardPickerOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );

  if (mode === 'home-tab') {
    return (
      <View style={styles.screen}>
        <ScreenHeader
          title={`Hi, ${firstName}`}
          subtitle={user?.calling ? `${user.calling}${user.ward ? ` · ${user.ward}` : ''}` : undefined}
          rightElement={<AvatarMenu />}
        />
        {body}
      </View>
    );
  }

  return <View style={styles.screen}>{body}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 18,
  },
  centeredScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 24,
    padding: 22,
    ...webShadowRgba('rgba(1, 97, 131, 0.18)', 0, 10, 20),
    elevation: 4,
  },
  heroEyebrow: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.78)',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  heroBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'Inter_400Regular',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  heroMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroMetaText: {
    fontSize: 13,
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
  heroMetricRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  heroMetric: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroMetricValue: {
    fontSize: 18,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  heroMetricLabel: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter_500Medium',
  },
  generatedAt: {
    marginTop: 14,
    fontSize: 13,
    color: 'rgba(255,255,255,0.74)',
    fontFamily: 'Inter_500Medium',
  },
  sectionCard: {
    backgroundColor: Colors.brand.cardBg,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 8, 18),
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  sectionMeta: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  controlBlock: {
    marginTop: 14,
    gap: 6,
  },
  controlLabel: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_600SemiBold',
  },
  pickerTrigger: {
    marginTop: 2,
  },
  lockedScopeRow: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: '#D8E8EE',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lockedScopeText: {
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  currentWeekLabel: {
    fontSize: 19,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  currentWeekMeta: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  weekNavStack: {
    gap: 10,
    marginTop: 16,
  },
  weekNavButton: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    backgroundColor: Colors.brand.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  weekNavButtonActive: {
    borderColor: '#B7E3CF',
    backgroundColor: '#F5FBF7',
  },
  weekNavButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  weekNavTitle: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  weekNavSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  weekNavChevronLeft: {
    transform: [{ rotate: '180deg' }],
  },
  cardList: {
    gap: 14,
  },
  preparedCardList: {
    gap: 12,
  },
  summaryCard: {
    backgroundColor: Colors.brand.cardBg,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 8, 18),
    elevation: 2,
  },
  summaryCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  summaryCardHeader: {
    gap: 12,
  },
  summaryCardTitleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCardTitleBlock: {
    flex: 1,
  },
  summaryCardTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  summaryCardSummary: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  summaryCardBadge: {
    alignSelf: 'flex-start',
  },
  metricPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  metricPill: {
    minWidth: '31%',
    flexGrow: 1,
    borderRadius: 16,
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: '#D8E8EE',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricPillValue: {
    fontSize: 17,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  metricPillLabel: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  highlightList: {
    marginTop: 14,
    gap: 10,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  highlightBody: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  highlightMeta: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  highlightDetail: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  summaryCardFooter: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCardFooterText: {
    fontSize: 14,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  loadingCard: {
    backgroundColor: Colors.brand.cardBg,
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  stateCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 8, 18),
    elevation: 2,
  },
  stateTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  stateBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  errorTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  errorBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  retryButton: {
    marginTop: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.38)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 24,
    padding: 20,
    maxHeight: '75%',
    ...webShadowRgba('rgba(15, 23, 42, 0.16)', 0, 10, 24),
    elevation: 4,
  },
  modalTitle: {
    fontSize: 19,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  modalList: {
    marginBottom: 16,
  },
  modalOption: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOptionSelected: {
    backgroundColor: '#F5FBF7',
  },
  modalOptionPressed: {
    opacity: 0.84,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  modalOptionTextSelected: {
    color: Colors.brand.primary,
    fontFamily: 'Inter_700Bold',
  },
});

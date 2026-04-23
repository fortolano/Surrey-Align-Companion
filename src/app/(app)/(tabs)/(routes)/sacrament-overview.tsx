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
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { appAlert } from '@/lib/platform-alert';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import PreparedLeadershipCard from '@/components/PreparedLeadershipCard';
import AppButton from '@/components/ui/AppButton';
import AppPickerTrigger from '@/components/ui/AppPickerTrigger';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';
import type { LeadershipIntelligenceArtifact } from '@/lib/leadership-intelligence';
import { uniqueLeadershipLines } from '@/lib/leadership-intelligence';

interface WardOption {
  id: number;
  name: string;
}

interface PlannerMeeting {
  id: number | null;
  meeting_date: string;
  meeting_date_label: string;
  status: string;
  status_label: string;
  has_ordinance_row: boolean;
  speaker_slots_filled: number;
  speaker_slots_total: number;
  announcement_count: number;
  completion_checks: {
    standard_flow_present: boolean;
    active_announcements_reviewed: boolean;
    publish_ready: boolean;
  };
  missing_checks: string[];
  leadership_intelligence?: {
    sacrament_readiness_brief?: LeadershipIntelligenceArtifact<SacramentReadinessPayload> | null;
  };
}

interface SacramentReadinessPayload {
  summary_sentence?: string;
  opening_question?: string;
  readiness_focus?: string;
  speaker_watch?: string;
  publish_watch?: string;
  recommended_actions?: {
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

interface SpeakerHistoryItem {
  assignment_id: number;
  user_id: number | null;
  name: string;
  date: string | null;
  date_label: string | null;
  speaker_source: string;
}

interface OverviewResponse {
  success: boolean;
  ward: WardOption;
  weeks: number;
  meetings: PlannerMeeting[];
  speaker_history: SpeakerHistoryItem[];
  generated_at: string;
}

interface AnnouncementItem {
  id: number;
  scope: string;
  scope_label: string;
  status: string;
  status_label: string;
  title: string;
  body: string;
  display_from: string | null;
  display_until: string | null;
  target_ward_ids: number[];
}

interface AnnouncementsResponse {
  success: boolean;
  ward: WardOption;
  meeting_date: string;
  meeting: {
    id: number;
    meeting_date: string;
    status: string;
    status_label: string;
    announcement_review: {
      reviewed_at: string | null;
      reviewed_by: {
        id: number;
        name: string;
      } | null;
      can_mark_reviewed: boolean;
    };
    readiness_stage: string;
    readiness_stage_label: string;
    completion_checks: {
      active_announcements_reviewed: boolean;
      publish_ready: boolean;
    };
    missing_checks: string[];
  } | null;
  announcements: AnnouncementItem[];
  meta: {
    total: number;
    stake_announcement_count: number;
    ward_announcement_count: number;
  };
}

interface SpeakerFollowUpResponse {
  success: boolean;
  phase4: {
    mobile_scope: string;
    desktop_planning_home: boolean;
  };
  meeting: {
    id: number;
    ward: WardOption;
    meeting_date: string;
    meeting_date_label: string;
    status: string;
    status_label: string;
    meeting_mode: string;
    meeting_mode_label: string;
    readiness_stage: string;
    readiness_stage_label: string;
    speaker_follow_up: {
      allowed: boolean;
      blocked_reason: string | null;
      open_invitation_count: number;
    };
  };
  follow_up: {
    id: number;
    invitee: {
      id: number | null;
      name: string;
    };
    meeting_id: number;
    meeting_date: string;
    meeting_date_label: string;
    topic_hint: string | null;
    status: string;
    status_label: string;
    respond_by: string | null;
    respond_by_label: string | null;
    follow_up_note: string | null;
    follow_up_date: string | null;
    delivery: {
      state: 'opened' | 'email_sent' | 'manual_contact_recorded' | 'not_contacted';
      state_label: string;
      has_contact_email: boolean;
      contact_email: string | null;
      sent_at: string | null;
      opened_at: string | null;
    };
    follow_up_action: {
      allowed: boolean;
      mode: 'email_reminder' | 'manual_contact_reminder' | null;
      label: string | null;
      blocked_reason: string | null;
    };
  }[];
  meta: {
    open_invitation_count: number;
    needs_follow_up_count: number;
    emailed_count: number;
    opened_count: number;
  };
}

const WEEK_OPTIONS = [
  { key: '4', label: '4 weeks' },
  { key: '6', label: '6 weeks' },
  { key: '8', label: '8 weeks' },
] as const;

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  if (Array.isArray(value)) {
    return firstString(value[0]);
  }

  return undefined;
}

function formatGeneratedAt(value?: string | null): string {
  if (!value) return 'Just refreshed';

  try {
    return `Updated ${new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  } catch {
    return 'Just refreshed';
  }
}

function formatDateTimeLabel(value?: string | null): string {
  if (!value) return 'Just updated';

  try {
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Just updated';
  }
}

function statusTone(status: string): { bg: string; text: string } {
  if (status === 'published') {
    return { bg: '#D1FAE5', text: '#065F46' };
  }

  if (status === 'draft') {
    return { bg: '#FEF3C7', text: '#92400E' };
  }

  if (status === 'not_started') {
    return { bg: '#E2E8F0', text: '#475569' };
  }

  return { bg: '#DBEAFE', text: '#1E40AF' };
}

function sourceTone(source: string): { bg: string; text: string } {
  if (source === 'local_invitation') {
    return { bg: '#E0F2FE', text: '#075985' };
  }

  return { bg: '#EEF2FF', text: '#4338CA' };
}

function deliveryTone(state: SpeakerFollowUpResponse['follow_up'][number]['delivery']['state']): { bg: string; text: string } {
  if (state === 'opened') {
    return { bg: '#DCFCE7', text: '#166534' };
  }

  if (state === 'email_sent') {
    return { bg: '#DBEAFE', text: '#1D4ED8' };
  }

  if (state === 'manual_contact_recorded') {
    return { bg: '#FEF3C7', text: '#92400E' };
  }

  return { bg: '#E5E7EB', text: '#4B5563' };
}

function OverviewCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={[styles.checkPill, ok ? styles.checkPillOk : styles.checkPillMissing]}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'alert-circle'}
        size={14}
        color={ok ? '#065F46' : '#B45309'}
      />
      <Text style={[styles.checkPillText, ok ? styles.checkPillTextOk : styles.checkPillTextMissing]}>
        {label}
      </Text>
    </View>
  );
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
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={28} color={Colors.brand.midGray} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function buildSacramentBriefBullets(
  artifact?: LeadershipIntelligenceArtifact<SacramentReadinessPayload> | null
): string[] {
  const payload = artifact?.payload;
  if (!payload) return [];

  const recommendedActions = Array.isArray(payload.recommended_actions) ? payload.recommended_actions : [];
  const watchItems = Array.isArray(payload.watch_items) ? payload.watch_items : [];

  return uniqueLeadershipLines([
    ...recommendedActions.flatMap((item) => [item.title, item.why_now, item.next_step]),
    ...watchItems.flatMap((item) => [item.title, item.detail, item.timing]),
  ], 3);
}

export default function SacramentOverviewScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    wardId?: string | string[];
    meetingDate?: string | string[];
    announcementId?: string | string[];
    weeks?: string | string[];
  }>();
  const webBottomInset = WEB_BOTTOM_INSET;

  const canSeeOverview = !!(user?.is_bishopric_member || user?.is_high_councilor || user?.is_stake_presidency_member);
  const canSeeAllWards = !!(user?.is_high_councilor || user?.is_stake_presidency_member);
  const canManageWardSunday = !!user?.is_bishopric_member && !canSeeAllWards;

  const initialWeeks = useMemo(() => {
    const requested = Number(firstString(params.weeks));
    return requested === 4 || requested === 8 ? requested : 6;
  }, [params.weeks]);

  const requestedWardId = useMemo(() => {
    const value = Number(firstString(params.wardId));
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [params.wardId]);

  const requestedMeetingDate = useMemo(() => firstString(params.meetingDate), [params.meetingDate]);
  const highlightedAnnouncementId = useMemo(() => {
    const value = Number(firstString(params.announcementId));
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [params.announcementId]);

  const [weeks, setWeeks] = useState<number>(initialWeeks);
  const [wardPickerOpen, setWardPickerOpen] = useState(false);
  const [selectedWardId, setSelectedWardId] = useState<number | null>(() => {
    if (!canSeeAllWards) {
      return user?.ward_id ?? null;
    }

    return requestedWardId;
  });
  const [selectedMeetingDate, setSelectedMeetingDate] = useState<string | null>(requestedMeetingDate ?? null);

  const wardsQuery = useQuery<{ wards: WardOption[] }>({
    queryKey: ['/api/reference/wards'],
    queryFn: () => authFetch(token, '/api/reference/wards'),
    enabled: !!token && canSeeAllWards,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!canSeeAllWards) {
      setSelectedWardId(user?.ward_id ?? null);
      return;
    }

    const wards = wardsQuery.data?.wards ?? [];
    if (wards.length === 0) return;

    setSelectedWardId((current) => {
      if (current && wards.some((ward) => ward.id === current)) {
        return current;
      }

      if (requestedWardId && wards.some((ward) => ward.id === requestedWardId)) {
        return requestedWardId;
      }

      return wards[0].id;
    });
  }, [canSeeAllWards, requestedWardId, user?.ward_id, wardsQuery.data?.wards]);

  const overviewQuery = useQuery<OverviewResponse>({
    queryKey: ['/api/sacrament-planner/overview', selectedWardId, weeks],
    queryFn: () => authFetch(token, '/api/sacrament-planner/overview', {
      params: {
        ward_id: String(selectedWardId),
        weeks: String(weeks),
      },
    }),
    enabled: !!token && canSeeOverview && !!selectedWardId,
    staleTime: 60000,
  });

  const meetings = useMemo(() => overviewQuery.data?.meetings ?? [], [overviewQuery.data?.meetings]);

  useEffect(() => {
    if (meetings.length === 0) {
      setSelectedMeetingDate(null);
      return;
    }

    setSelectedMeetingDate((current) => {
      if (current && meetings.some((meeting) => meeting.meeting_date === current)) {
        return current;
      }

      if (requestedMeetingDate && meetings.some((meeting) => meeting.meeting_date === requestedMeetingDate)) {
        return requestedMeetingDate;
      }

      return meetings[0].meeting_date;
    });
  }, [meetings, requestedMeetingDate]);

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.meeting_date === selectedMeetingDate) ?? meetings[0] ?? null,
    [meetings, selectedMeetingDate]
  );

  const announcementsQuery = useQuery<AnnouncementsResponse>({
    queryKey: ['/api/announcements/active', selectedWardId, selectedMeeting?.meeting_date],
    queryFn: () => authFetch(token, '/api/announcements/active', {
      params: {
        ward_id: String(selectedWardId),
        meeting_date: String(selectedMeeting?.meeting_date),
      },
    }),
    enabled: !!token && canSeeOverview && !!selectedWardId && !!selectedMeeting?.meeting_date,
    staleTime: 60000,
  });

  const speakerFollowUpQuery = useQuery<SpeakerFollowUpResponse>({
    queryKey: ['/api/sacrament-planner/speaker-follow-up', selectedMeeting?.id],
    queryFn: () => authFetch(token, `/api/sacrament-planner/${selectedMeeting?.id}/speaker-follow-up`),
    enabled: !!token && canManageWardSunday && !!selectedMeeting?.id,
    staleTime: 60000,
  });

  const refreshSacramentQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/sacrament-planner/overview'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/active'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/sacrament-planner/speaker-follow-up'] }),
    ]);
    triggerGlobalRefreshIndicator();
  }, [queryClient]);

  const reviewMutation = useMutation({
    mutationFn: (meetingId: number) =>
      authFetch(token, `/api/sacrament-planner/${meetingId}/announcements/reviewed`, {
        method: 'POST',
      }),
    onSuccess: async (data: any) => {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await refreshSacramentQueries();
      appAlert('Announcements reviewed', data?.message || 'The Sunday queue is now marked reviewed for this meeting.');
    },
    onError: (error: any) => {
      appAlert('Unable to mark announcements reviewed', error?.message || 'Please try again.');
    },
  });

  const reminderMutation = useMutation({
    mutationFn: ({ meetingId, invitationId }: { meetingId: number; invitationId: number }) =>
      authFetch(token, `/api/sacrament-planner/${meetingId}/speaker-follow-up/${invitationId}/remind`, {
        method: 'POST',
      }),
    onSuccess: async (data: any) => {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await refreshSacramentQueries();
      appAlert('Speaker follow-up updated', data?.message || 'The speaker follow-up action has been recorded.');
    },
    onError: (error: any) => {
      appAlert('Unable to update speaker follow-up', error?.message || 'Please try again.');
    },
  });

  const onRefresh = useCallback(async () => {
    await Promise.all([
      overviewQuery.refetch(),
      announcementsQuery.refetch(),
      canManageWardSunday && selectedMeeting?.id ? speakerFollowUpQuery.refetch() : Promise.resolve(),
      canSeeAllWards ? wardsQuery.refetch() : Promise.resolve(),
    ]);
    triggerGlobalRefreshIndicator();
  }, [announcementsQuery, canManageWardSunday, canSeeAllWards, overviewQuery, selectedMeeting?.id, speakerFollowUpQuery, wardsQuery]);

  const selectedWardName = useMemo(() => {
    if (overviewQuery.data?.ward?.name) {
      return overviewQuery.data.ward.name;
    }

    if (canSeeAllWards) {
      return wardsQuery.data?.wards?.find((ward) => ward.id === selectedWardId)?.name ?? 'Choose ward';
    }

    return user?.ward ?? 'My ward';
  }, [canSeeAllWards, overviewQuery.data?.ward?.name, selectedWardId, user?.ward, wardsQuery.data?.wards]);

  const announcementItems = announcementsQuery.data?.announcements ?? [];
  const selectedAnnouncementMeeting = announcementsQuery.data?.meeting ?? null;
  const selectedMeetingBrief = selectedMeeting?.leadership_intelligence?.sacrament_readiness_brief ?? null;
  const shouldShowAnnouncementReviewCard = !!selectedMeeting?.meeting_date && (
    !!selectedAnnouncementMeeting
    || announcementItems.length > 0
    || (canManageWardSunday && !!selectedMeeting && selectedMeeting.id === null)
  );
  const speakerFollowUpItems = speakerFollowUpQuery.data?.follow_up ?? [];

  if (!canSeeOverview) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: 20 + insets.top, paddingBottom: 24 + insets.bottom + webBottomInset }]}
      >
        <EmptyState
          icon="lock-closed-outline"
          title="This view is limited to bishopric and stake review roles"
          body="Sacrament overview is available to bishopric members for their own ward and to high councilors and stake presidency across the stake."
        />
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: 20 + insets.top, paddingBottom: 24 + insets.bottom + webBottomInset }]}
        refreshControl={
          <RefreshControl
            refreshing={overviewQuery.isRefetching || announcementsQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={Colors.brand.primary}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Weekly planning at a glance</Text>
          <Text style={styles.heroTitle}>Sacrament Overview</Text>
          <Text style={styles.heroBody}>
            Review weekly readiness, active sacrament announcements, and recent speaker history without opening the full desktop planner.
          </Text>
          <Text style={styles.generatedAt}>{formatGeneratedAt(overviewQuery.data?.generated_at)}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Scope</Text>
          {canSeeAllWards ? (
            <View style={styles.controlBlock}>
              <Text style={styles.controlLabel}>Ward</Text>
              <AppPickerTrigger
                label={selectedWardName}
                onPress={() => setWardPickerOpen(true)}
              />
            </View>
          ) : (
            <View style={styles.lockedScopeRow}>
              <Ionicons name="home-outline" size={16} color={Colors.brand.primary} />
              <Text style={styles.lockedScopeText}>{selectedWardName}</Text>
            </View>
          )}

          <View style={styles.controlBlock}>
            <Text style={styles.controlLabel}>Planning window</Text>
            <AppSegmentedControl
              items={WEEK_OPTIONS.map((item) => ({ key: item.key, label: item.label }))}
              activeKey={String(weeks)}
              onChange={(key) => {
                const nextWeeks = Number(key);
                if (nextWeeks !== 4 && nextWeeks !== 6 && nextWeeks !== 8) return;
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setWeeks(nextWeeks);
              }}
              testIDPrefix="sacrament-overview-weeks"
            />
          </View>
        </View>

        {overviewQuery.isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.brand.primary} />
            <Text style={styles.loadingText}>Loading weekly sacrament overview…</Text>
          </View>
        ) : overviewQuery.isError ? (
          <View style={styles.sectionCard}>
            <Text style={styles.errorTitle}>This overview could not be loaded</Text>
            <Text style={styles.errorBody}>
              The app could not read the current sacrament overview for this ward selection.
            </Text>
            <AppButton label="Try again" onPress={() => void overviewQuery.refetch()} style={styles.retryButton} />
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Sundays</Text>
              <Text style={styles.sectionMeta}>{meetings.length} meetings</Text>
            </View>

            {meetings.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No overview meetings are available"
                body="Upcoming sacrament planning will appear here once the ward has upcoming Sundays to review."
              />
            ) : (
              <View style={styles.cardList}>
                {meetings.map((meeting) => {
                  const selected = selectedMeeting?.meeting_date === meeting.meeting_date;
                  const tone = statusTone(meeting.status);
                  return (
                    <Pressable
                      key={meeting.meeting_date}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.selectionAsync();
                        }
                        setSelectedMeetingDate(meeting.meeting_date);
                      }}
                      style={({ pressed }) => [
                        styles.meetingCard,
                        selected && styles.meetingCardSelected,
                        pressed && styles.meetingCardPressed,
                      ]}
                    >
                      <View style={styles.meetingHeader}>
                        <View>
                          <Text style={styles.meetingDate}>{meeting.meeting_date_label}</Text>
                          <Text style={styles.meetingStatusSubtitle}>
                            {meeting.id ? 'Program started' : 'Program not started'}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: tone.text }]}>{meeting.status_label}</Text>
                        </View>
                      </View>

                      <View style={styles.checkRow}>
                        <OverviewCheck ok={meeting.completion_checks.standard_flow_present} label="Standard flow" />
                        <OverviewCheck
                          ok={meeting.speaker_slots_total > 0 && meeting.speaker_slots_filled >= meeting.speaker_slots_total}
                          label={`Speakers ${meeting.speaker_slots_filled}/${meeting.speaker_slots_total}`}
                        />
                        <OverviewCheck ok={meeting.completion_checks.active_announcements_reviewed} label="Announcements" />
                      </View>

                      <View style={styles.metricRow}>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricValue}>{meeting.announcement_count}</Text>
                          <Text style={styles.metricLabel}>active announcements</Text>
                        </View>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricValue}>{meeting.has_ordinance_row ? 'Yes' : 'No'}</Text>
                          <Text style={styles.metricLabel}>ordinance row ready</Text>
                        </View>
                        <View style={styles.metricItem}>
                          <Text
                            style={[
                              styles.metricValue,
                              { color: meeting.completion_checks.publish_ready ? '#065F46' : '#B45309' },
                            ]}
                          >
                            {meeting.completion_checks.publish_ready ? 'Ready' : 'Not ready'}
                          </Text>
                          <Text style={styles.metricLabel}>publish state</Text>
                        </View>
                      </View>

                      {meeting.missing_checks.length > 0 && (
                        <View style={styles.missingList}>
                          {meeting.missing_checks.map((check) => (
                            <View key={`${meeting.meeting_date}-${check}`} style={styles.missingRow}>
                              <Ionicons name="alert-circle-outline" size={14} color="#B45309" />
                              <Text style={styles.missingText}>{check}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {selectedMeetingBrief ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {selectedMeeting ? `Prepared Sunday brief for ${selectedMeeting.meeting_date_label}` : 'Prepared Sunday brief'}
                  </Text>
                  <Text style={styles.sectionMeta}>{selectedMeetingBrief.status_label}</Text>
                </View>

                <PreparedLeadershipCard
                  eyebrow={selectedMeetingBrief.context_label ?? 'Prepared Sunday brief'}
                  title={selectedMeetingBrief.title}
                  summary={selectedMeetingBrief.summary_sentence || selectedMeetingBrief.payload.summary_sentence || 'This Sunday already has a prepared leadership read.'}
                  question={selectedMeetingBrief.payload.opening_question}
                  focus={selectedMeetingBrief.payload.readiness_focus}
                  bullets={buildSacramentBriefBullets(selectedMeetingBrief)}
                  note={selectedMeetingBrief.payload.speaker_watch || selectedMeetingBrief.payload.publish_watch || undefined}
                  generatedLabel={selectedMeetingBrief.generated_label}
                  statusLabel={selectedMeetingBrief.status_label}
                  statusTone={selectedMeetingBrief.status_tone}
                  icon="calendar-outline"
                  testID="sacrament-overview-prepared-brief"
                />
              </>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedMeeting ? `Active announcements for ${selectedMeeting.meeting_date_label}` : 'Active announcements'}
              </Text>
              {announcementsQuery.data?.meta ? (
                <Text style={styles.sectionMeta}>{announcementsQuery.data.meta.total} items</Text>
              ) : null}
            </View>

            {shouldShowAnnouncementReviewCard ? (
              <View style={styles.sectionCard}>
                <View style={styles.actionHeaderRow}>
                  <View style={styles.actionHeaderCopy}>
                    <Text style={styles.actionHeaderTitle}>Sunday queue review</Text>
                    <Text style={styles.actionHeaderBody}>
                      {selectedAnnouncementMeeting?.announcement_review.reviewed_at
                        ? `Reviewed ${formatDateTimeLabel(selectedAnnouncementMeeting.announcement_review.reviewed_at)}${selectedAnnouncementMeeting.announcement_review.reviewed_by ? ` by ${selectedAnnouncementMeeting.announcement_review.reviewed_by.name}` : ''}.`
                        : selectedAnnouncementMeeting
                        ? (announcementItems.length > 0
                            ? 'Confirm the active ward and stake items, then mark this Sunday queue reviewed.'
                            : 'No active sacrament announcements are waiting for this Sunday.')
                        : 'Start this meeting on desktop before recording bishopric announcement review on mobile.'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.actionStatusBadge,
                      selectedAnnouncementMeeting?.announcement_review.reviewed_at
                        ? styles.actionStatusBadgeSuccess
                        : announcementItems.length > 0
                        ? styles.actionStatusBadgePending
                        : styles.actionStatusBadgeNeutral,
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionStatusBadgeText,
                        selectedAnnouncementMeeting?.announcement_review.reviewed_at
                          ? styles.actionStatusBadgeTextSuccess
                          : announcementItems.length > 0
                          ? styles.actionStatusBadgeTextPending
                          : styles.actionStatusBadgeTextNeutral,
                      ]}
                    >
                      {selectedAnnouncementMeeting?.announcement_review.reviewed_at
                        ? 'Reviewed'
                        : announcementItems.length > 0
                        ? 'Needs review'
                        : 'No active items'}
                    </Text>
                  </View>
                </View>

                {selectedAnnouncementMeeting?.announcement_review.can_mark_reviewed
                && !selectedAnnouncementMeeting.announcement_review.reviewed_at
                && announcementItems.length > 0 ? (
                  <AppButton
                    label="Mark reviewed"
                    variant="secondary"
                    loading={reviewMutation.isPending}
                    onPress={() => reviewMutation.mutate(selectedAnnouncementMeeting.id)}
                    style={styles.inlineActionButton}
                    testID="sacrament-announcement-review-button"
                  />
                ) : null}

                {!selectedAnnouncementMeeting?.announcement_review.can_mark_reviewed
                && selectedAnnouncementMeeting
                && announcementItems.length > 0 ? (
                  <Text style={styles.actionSupportText}>
                    Announcement review stays with the bishopric for this ward.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {announcementsQuery.isLoading ? (
              <View style={styles.loadingInlineCard}>
                <ActivityIndicator size="small" color={Colors.brand.primary} />
                <Text style={styles.loadingInlineText}>Loading announcements…</Text>
              </View>
            ) : announcementItems.length === 0 ? (
              <EmptyState
                icon="megaphone-outline"
                title="No active sacrament announcements"
                body="Ward and stake sacrament announcements for the selected Sunday will appear here."
              />
            ) : (
              <View style={styles.cardList}>
                {announcementItems.map((announcement) => {
                  const highlighted = highlightedAnnouncementId === announcement.id;
                  return (
                    <View
                      key={announcement.id}
                      style={[styles.announcementCard, highlighted && styles.announcementCardHighlighted]}
                    >
                      <View style={styles.announcementHeader}>
                        <View style={[styles.scopeBadge, announcement.scope === 'stake' ? styles.scopeBadgeStake : styles.scopeBadgeWard]}>
                          <Text
                            style={[
                              styles.scopeBadgeText,
                              announcement.scope === 'stake' ? styles.scopeBadgeTextStake : styles.scopeBadgeTextWard,
                            ]}
                          >
                            {announcement.scope_label}
                          </Text>
                        </View>
                        <Text style={styles.announcementDate}>
                          {announcement.display_from ?? 'Now'}{announcement.display_until ? ` to ${announcement.display_until}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.announcementTitle}>{announcement.title}</Text>
                      <Text style={styles.announcementBody}>{announcement.body}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {canManageWardSunday ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {selectedMeeting ? `Speaker follow-up for ${selectedMeeting.meeting_date_label}` : 'Speaker follow-up'}
                  </Text>
                  {speakerFollowUpQuery.data?.meta ? (
                    <Text style={styles.sectionMeta}>{speakerFollowUpQuery.data.meta.open_invitation_count} open</Text>
                  ) : null}
                </View>

                {!selectedMeeting?.id ? (
                  <View style={styles.sectionCard}>
                    <Text style={styles.actionHeaderTitle}>Desktop starts the invitation cycle</Text>
                    <Text style={styles.actionHeaderBody}>
                      Use the desktop planner to start or reshape the Sunday speaker plan. Mobile follow-up appears here after the meeting exists and local invitations are already open.
                    </Text>
                  </View>
                ) : speakerFollowUpQuery.isLoading ? (
                  <View style={styles.loadingInlineCard}>
                    <ActivityIndicator size="small" color={Colors.brand.primary} />
                    <Text style={styles.loadingInlineText}>Loading speaker follow-up…</Text>
                  </View>
                ) : speakerFollowUpQuery.isError ? (
                  <View style={styles.sectionCard}>
                    <Text style={styles.errorTitle}>Speaker follow-up could not be loaded</Text>
                    <Text style={styles.errorBody}>
                      The app could not load the current open local invitations for this Sunday.
                    </Text>
                    <AppButton
                      label="Try again"
                      variant="secondary"
                      onPress={() => void speakerFollowUpQuery.refetch()}
                      style={styles.inlineActionButton}
                    />
                  </View>
                ) : (
                  <>
                    {speakerFollowUpQuery.data?.meeting?.speaker_follow_up.blocked_reason ? (
                      <View style={styles.sectionCard}>
                        <Text style={styles.actionHeaderTitle}>Follow-up stays read-only for this Sunday</Text>
                        <Text style={styles.actionHeaderBody}>
                          {speakerFollowUpQuery.data.meeting.speaker_follow_up.blocked_reason}
                        </Text>
                      </View>
                    ) : null}

                    {speakerFollowUpItems.length === 0 ? (
                      <View style={styles.sectionCard}>
                        <Text style={styles.actionHeaderTitle}>No open speaker follow-up is waiting</Text>
                        <Text style={styles.actionHeaderBody}>
                          Once local invitations move into invited or needs-follow-up status, they will appear here for quick mobile continuity.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.cardList}>
                        {speakerFollowUpItems.map((item) => {
                          const tone = deliveryTone(item.delivery.state);
                          const isRunning = reminderMutation.isPending && reminderMutation.variables?.invitationId === item.id;
                          return (
                            <View key={item.id} style={styles.followUpCard}>
                              <View style={styles.followUpHeader}>
                                <View style={styles.followUpHeaderCopy}>
                                  <Text style={styles.followUpName}>{item.invitee.name}</Text>
                                  <Text style={styles.followUpMetaText}>
                                    {item.topic_hint ? item.topic_hint : item.status_label}
                                  </Text>
                                </View>
                                <View style={[styles.followUpBadge, { backgroundColor: tone.bg }]}>
                                  <Text style={[styles.followUpBadgeText, { color: tone.text }]}>
                                    {item.delivery.state_label}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.followUpMetaList}>
                                <Text style={styles.followUpMetaText}>
                                  {item.delivery.opened_at
                                    ? `Opened ${formatDateTimeLabel(item.delivery.opened_at)}`
                                    : item.delivery.sent_at
                                    ? `Last contact ${formatDateTimeLabel(item.delivery.sent_at)}`
                                    : 'First contact still starts on desktop'}
                                </Text>
                                {item.respond_by_label ? (
                                  <Text style={styles.followUpMetaText}>Respond by {item.respond_by_label}</Text>
                                ) : null}
                                {item.follow_up_date ? (
                                  <Text style={styles.followUpMetaText}>Last follow-up note date {item.follow_up_date}</Text>
                                ) : null}
                                {item.delivery.has_contact_email && item.delivery.contact_email ? (
                                  <Text style={styles.followUpMetaText}>{item.delivery.contact_email}</Text>
                                ) : (
                                  <Text style={styles.followUpMetaText}>Manual bishopric contact only</Text>
                                )}
                              </View>

                              {item.follow_up_note ? (
                                <View style={styles.followUpNoteCard}>
                                  <Text style={styles.followUpNoteLabel}>Follow-up note</Text>
                                  <Text style={styles.followUpNoteBody}>{item.follow_up_note}</Text>
                                </View>
                              ) : null}

                              {item.follow_up_action.allowed && item.follow_up_action.label ? (
                                <AppButton
                                  label={item.follow_up_action.label}
                                  variant="secondary"
                                  loading={isRunning}
                                  onPress={() => reminderMutation.mutate({ meetingId: item.meeting_id, invitationId: item.id })}
                                  style={styles.inlineActionButton}
                                  testID={`sacrament-speaker-follow-up-${item.id}`}
                                />
                              ) : (
                                <Text style={styles.actionSupportText}>
                                  {item.follow_up_action.blocked_reason ?? 'This invitation does not need a mobile follow-up action.'}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent speaker history</Text>
              <Text style={styles.sectionMeta}>{overviewQuery.data?.speaker_history?.length ?? 0} recent speakers</Text>
            </View>

            {(overviewQuery.data?.speaker_history?.length ?? 0) === 0 ? (
              <EmptyState
                icon="mic-outline"
                title="No recent speaker history is available"
                body="Committed speaker history will appear here as assignments continue across upcoming Sundays."
              />
            ) : (
              <View style={styles.sectionCard}>
                {(overviewQuery.data?.speaker_history ?? []).map((speaker) => {
                  const tone = sourceTone(speaker.speaker_source);
                  return (
                    <View key={speaker.assignment_id} style={styles.historyRow}>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyName}>{speaker.name}</Text>
                        <Text style={styles.historyDate}>{speaker.date_label ?? 'Recent Sunday'}</Text>
                      </View>
                      <View style={[styles.historyBadge, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.historyBadgeText, { color: tone.text }]}>
                          {speaker.speaker_source === 'local_invitation' ? 'Local invitation' : 'Speaking schedule'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

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
              {(wardsQuery.data?.wards ?? []).map((ward) => {
                const selected = ward.id === selectedWardId;
                return (
                  <Pressable
                    key={ward.id}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.selectionAsync();
                      }
                      setSelectedWardId(ward.id);
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
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 18,
    gap: 18,
  },
  heroCard: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 24,
    padding: 22,
    ...webShadowRgba('rgba(1, 97, 131, 0.18)', 0, 10, 20),
    elevation: 4,
  },
  eyebrow: {
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
    marginBottom: 10,
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'Inter_400Regular',
  },
  generatedAt: {
    marginTop: 12,
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
    gap: 8,
    marginTop: 14,
  },
  controlLabel: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_600SemiBold',
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
  loadingInlineCard: {
    backgroundColor: Colors.brand.cardBg,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  loadingInlineText: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  errorTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  errorBody: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  actionHeaderTitle: {
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  actionHeaderBody: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  actionStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionStatusBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  actionStatusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  actionStatusBadgeNeutral: {
    backgroundColor: '#E5E7EB',
  },
  actionStatusBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  actionStatusBadgeTextSuccess: {
    color: '#166534',
  },
  actionStatusBadgeTextPending: {
    color: '#92400E',
  },
  actionStatusBadgeTextNeutral: {
    color: '#4B5563',
  },
  inlineActionButton: {
    marginTop: 14,
  },
  actionSupportText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  cardList: {
    gap: 14,
  },
  meetingCard: {
    backgroundColor: Colors.brand.cardBg,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 8, 18),
    elevation: 2,
  },
  meetingCardSelected: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#F7FBFD',
  },
  meetingCardPressed: {
    opacity: 0.92,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  meetingDate: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  meetingStatusSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  checkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  checkPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkPillOk: {
    backgroundColor: '#ECFDF5',
  },
  checkPillMissing: {
    backgroundColor: '#FFFBEB',
  },
  checkPillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  checkPillTextOk: {
    color: '#065F46',
  },
  checkPillTextMissing: {
    color: '#B45309',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  metricItem: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  metricValue: {
    fontSize: 17,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  missingList: {
    gap: 8,
    marginTop: 14,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  missingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
    fontFamily: 'Inter_500Medium',
  },
  announcementCard: {
    backgroundColor: Colors.brand.cardBg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  announcementCardHighlighted: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#F7FBFD',
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  scopeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scopeBadgeStake: {
    backgroundColor: '#E0F2FE',
  },
  scopeBadgeWard: {
    backgroundColor: '#ECFDF5',
  },
  scopeBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  scopeBadgeTextStake: {
    color: '#075985',
  },
  scopeBadgeTextWard: {
    color: '#065F46',
  },
  announcementDate: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  announcementTitle: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  announcementBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  followUpCard: {
    backgroundColor: Colors.brand.cardBg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  followUpHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  followUpHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  followUpName: {
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  followUpBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  followUpBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  followUpMetaList: {
    marginTop: 12,
    gap: 5,
  },
  followUpMetaText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  followUpNoteCard: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 4,
  },
  followUpNoteLabel: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  followUpNoteBody: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  historyDate: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  historyBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  historyBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  emptyCard: {
    backgroundColor: Colors.brand.cardBg,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    textAlign: 'center',
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 22,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 24,
    padding: 18,
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
    marginBottom: 14,
  },
  modalList: {
    marginBottom: 14,
  },
  modalOption: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalOptionSelected: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#F7FBFD',
  },
  modalOptionPressed: {
    opacity: 0.9,
  },
  modalOptionText: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  modalOptionTextSelected: {
    fontFamily: 'Inter_700Bold',
    color: Colors.brand.primary,
  },
});

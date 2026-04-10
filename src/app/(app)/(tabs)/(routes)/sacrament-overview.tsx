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
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import AppButton from '@/components/ui/AppButton';
import AppPickerTrigger from '@/components/ui/AppPickerTrigger';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';

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
  announcements: AnnouncementItem[];
  meta: {
    total: number;
    stake_announcement_count: number;
    ward_announcement_count: number;
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

export default function SacramentOverviewScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{
    wardId?: string | string[];
    meetingDate?: string | string[];
    announcementId?: string | string[];
    weeks?: string | string[];
  }>();
  const webBottomInset = WEB_BOTTOM_INSET;

  const canSeeOverview = !!(user?.is_bishopric_member || user?.is_high_councilor || user?.is_stake_presidency_member);
  const canSeeAllWards = !!(user?.is_high_councilor || user?.is_stake_presidency_member);

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

  const onRefresh = useCallback(async () => {
    await Promise.all([
      overviewQuery.refetch(),
      announcementsQuery.refetch(),
      canSeeAllWards ? wardsQuery.refetch() : Promise.resolve(),
    ]);
    triggerGlobalRefreshIndicator();
  }, [announcementsQuery, canSeeAllWards, overviewQuery, wardsQuery]);

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

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedMeeting ? `Active announcements for ${selectedMeeting.meeting_date_label}` : 'Active announcements'}
              </Text>
              {announcementsQuery.data?.meta ? (
                <Text style={styles.sectionMeta}>{announcementsQuery.data.meta.total} items</Text>
              ) : null}
            </View>

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

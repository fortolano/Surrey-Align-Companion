import React, { useCallback, useMemo } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import { useMyAgendaItems, type MyAgendaItem } from '@/lib/agenda-api';

// ─── Unified item type ──────────────────────────

type UnifiedItem =
  | { kind: 'calling'; data: CallingAction }
  | { kind: 'agenda'; data: MyAgendaItem };

interface CallingAction {
  id: number;
  target_calling: string | null;
  request_type_label: string;
  scope: 'stake' | 'ward';
  status: string;
  status_label: string;
  action_label: string;
  action_type: string;
  individuals: { name: string }[];
}

// ─── Icon maps ──────────────────────────────────

const ACTION_ICONS: Record<string, { name: string; color: string; bg: string }> = {
  vote: { name: 'hand-left-outline', color: '#B45309', bg: '#FEF3C7' },
  recommend: { name: 'star-outline', color: '#7C3AED', bg: '#F0E8F8' },
  review: { name: 'eye-outline', color: '#1E40AF', bg: '#DBEAFE' },
  decide: { name: 'shield-checkmark-outline', color: '#065F46', bg: '#D1FAE5' },
  complete: { name: 'checkmark-done-outline', color: '#065F46', bg: '#D1FAE5' },
  default: { name: 'flash-outline', color: Colors.brand.primary, bg: '#E8F4F8' },
};

const AGENDA_ITEM_ICONS: Record<string, string> = {
  prayer: 'hand-left-outline',
  hymn: 'musical-notes-outline',
  speaker: 'mic-outline',
  spiritual_thought: 'sunny-outline',
  discussion: 'chatbubble-ellipses-outline',
  action: 'checkmark-square-outline',
  report: 'clipboard-outline',
  training: 'school-outline',
  announcement: 'megaphone-outline',
  business: 'briefcase-outline',
  ministering: 'heart-outline',
  follow_up: 'arrow-redo-outline',
};

// ─── Card components ────────────────────────────

function CallingCard({ item, index }: { item: CallingAction; index: number }) {
  const icon = ACTION_ICONS[item.action_type] || ACTION_ICONS.default;

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(60 + index * 50)}>
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/calling-detail', params: { id: String(item.id) } });
        }}
        style={({ pressed }) => [styles.card, { borderLeftWidth: 4, borderLeftColor: '#B45309' }, pressed && styles.cardPressed]}
      >
        <View style={styles.cardRow}>
          <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name as any} size={20} color={icon.color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.target_calling || item.request_type_label}
            </Text>
            {item.individuals?.length > 0 && (
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {item.individuals.map(i => i.name).join(', ')}
              </Text>
            )}
            <View style={styles.chipRow}>
              <View style={styles.actionChip}>
                <Ionicons name="arrow-forward" size={11} color={Colors.brand.white} />
                <Text style={styles.actionChipText}>{item.action_label}</Text>
              </View>
              <View style={[styles.scopeChip, {
                backgroundColor: item.scope === 'stake' ? Colors.brand.primary + '15' : '#0F766E15',
              }]}>
                <Text style={[styles.scopeChipText, {
                  color: item.scope === 'stake' ? Colors.brand.primary : '#0F766E',
                }]}>
                  {item.scope === 'stake' ? 'Stake' : 'Ward'}
                </Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AgendaCard({ item, index }: { item: MyAgendaItem; index: number }) {
  const iconName = AGENDA_ITEM_ICONS[item.item_type] || 'clipboard-outline';

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.council_slug === 'high-council') {
      router.push('/high-council-agenda');
    } else if (item.council_slug === 'stake-council') {
      router.push('/stake-council-agenda');
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(60 + index * 50)}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.card, { borderLeftWidth: 4, borderLeftColor: Colors.brand.primary }, pressed && styles.cardPressed]}
      >
        <View style={styles.cardRow}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.brand.primary + '15' }]}>
            <Ionicons name={iconName as any} size={20} color={Colors.brand.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {item.council_name} Meeting{item.meeting_date_label ? ` · ${item.meeting_date_label}` : ''}{item.time_label ? ` · ${item.time_label}` : ''}
            </Text>
            <View style={styles.chipRow}>
              <View style={[styles.actionChip, { backgroundColor: Colors.brand.primary }]}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={11} color={Colors.brand.white} />
                <Text style={styles.actionChipText}>Your Assignment</Text>
              </View>
              {item.days_until !== null && item.days_until <= 7 && (
                <View style={[styles.scopeChip, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.scopeChipText, { color: '#92400E' }]}>
                    {item.time_label}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ────────────────────────────────

export default function AssignmentsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const { data: callingData, isLoading: callingLoading, isError: callingError, refetch: refetchCallings, isRefetching: callingRefetching } = useQuery<{
    success: boolean;
    action_required?: CallingAction[];
    calling_requests?: CallingAction[];
    action_items?: CallingAction[];
  }>({
    queryKey: ['/api/calling-requests/action-required'],
    queryFn: () => authFetch(token, '/api/calling-requests/action-required'),
    enabled: !!token,
    staleTime: 30000,
  });

  const { data: agendaData, isLoading: agendaLoading, refetch: refetchAgenda, isRefetching: agendaRefetching } = useMyAgendaItems();

  const callingItems = useMemo(() => {
    const raw = callingData?.action_required || callingData?.calling_requests || callingData?.action_items || [];
    return raw.map((ai: any): CallingAction => ({
      id: ai.id ?? ai.calling_request_id ?? 0,
      target_calling: ai.target_calling ?? ai.calling_name ?? ai.title ?? null,
      request_type_label: ai.request_type_label ?? ai.type_label ?? '',
      scope: ai.scope ?? 'stake',
      status: ai.status ?? '',
      status_label: ai.status_label ?? '',
      action_label: ai.action_label ?? ai.action ?? '',
      action_type: ai.action_type ?? '',
      individuals: ai.individuals ?? [],
    }));
  }, [callingData]);

  const agendaItems = useMemo(() => {
    return agendaData?.items || [];
  }, [agendaData]);

  // Merge into unified list: agenda items first (sorted by days_until), then calling items
  const unifiedItems = useMemo((): UnifiedItem[] => {
    const agenda: UnifiedItem[] = agendaItems
      .sort((a, b) => (a.days_until ?? 999) - (b.days_until ?? 999))
      .map((item) => ({ kind: 'agenda' as const, data: item }));
    const calling: UnifiedItem[] = callingItems.map((item) => ({ kind: 'calling' as const, data: item }));
    return [...agenda, ...calling];
  }, [agendaItems, callingItems]);

  const isLoading = callingLoading && agendaLoading;
  const isRefetching = callingRefetching || agendaRefetching;

  const handleRefresh = useCallback(async () => {
    triggerGlobalRefreshIndicator();
    await Promise.all([refetchCallings(), refetchAgenda()]);
  }, [refetchCallings, refetchAgenda]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={styles.loadingText}>Loading assignments...</Text>
      </View>
    );
  }

  if (callingError && !agendaData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
        <Text style={styles.errorTitle}>Unable to load assignments</Text>
        <Pressable onPress={() => handleRefresh()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: UnifiedItem; index: number }) => {
    if (item.kind === 'agenda') {
      return <AgendaCard item={item.data} index={index} />;
    }
    return <CallingCard item={item.data} index={index} />;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={unifiedItems}
        keyExtractor={(item, index) => item.kind === 'agenda' ? `agenda-${item.data.id}` : `calling-${item.data.id}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + WEB_BOTTOM_INSET + 20 },
          unifiedItems.length === 0 && styles.emptyContainer,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.primary}
            colors={[Colors.brand.primary]}
          />
        }
        ListHeaderComponent={
          unifiedItems.length > 0 ? (
            <Text style={styles.resultsCount}>
              {unifiedItems.length} action{unifiedItems.length !== 1 ? 's' : ''} requiring your attention
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="checkmark-circle-outline" size={40} color={Colors.brand.success} />
            </View>
            <Text style={styles.emptyTitle}>You&apos;re all caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No actions require your attention right now. Check back later for new assignments.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.brand.midGray,
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.dark,
    marginTop: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.brand.white,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  resultsCount: {
    fontSize: 15,
    color: Colors.brand.midGray,
    marginBottom: 12,
    fontFamily: 'Inter_500Medium',
  },
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 15,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B45309',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  actionChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
  scopeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  scopeChipText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D1FAE520',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
  },
});

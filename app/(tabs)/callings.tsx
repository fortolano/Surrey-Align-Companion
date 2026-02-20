import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { ListCardSkeleton } from '@/components/Skeleton';
import Colors from '@/constants/colors';
import { contentContainer, cardShadow } from '@/constants/styles';

interface ListIndividual {
  id: number;
  name: string;
  is_selected: boolean;
}

interface CallingRequestListItem {
  id: number;
  request_type: string;
  request_type_label: string;
  scope: 'stake' | 'ward';
  status: string;
  status_label: string;
  target_calling: string | null;
  target_ward: string | null;
  target_organization: string | null;
  approval_authority: string;
  approval_authority_label: string;
  submitted_by: string | null;
  submitted_at: string | null;
  individuals: ListIndividual[];
  selected_individual: string | null;
  steps_progress: number | null;
  updated_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  submitted: { bg: '#e0e7ff', text: '#3730a3' },
  discussion: { bg: '#dbeafe', text: '#1e40af' },
  voting: { bg: '#fef3c7', text: '#92400e' },
  approved: { bg: '#d1fae5', text: '#065f46' },
  not_approved: { bg: '#fce7f3', text: '#9d174d' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  completed: { bg: '#d1fae5', text: '#065f46' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'discussion', label: 'Under Consideration' },
  { value: 'voting', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'not_approved', label: 'Not Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function CallingCard({ item, index }: { item: CallingRequestListItem; index: number }) {
  const colors = STATUS_COLORS[item.status] || STATUS_COLORS.draft;

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/calling-detail', params: { id: String(item.id) } });
  };

  const individualsText = item.individuals
    .map(ind => ind.name + (ind.is_selected ? ' \u2713' : ''))
    .join(', ');

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(60 + index * 40)}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        testID={`calling-card-${item.id}`}
      >
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.target_calling || item.request_type_label}
        </Text>

        {(item.target_ward || item.target_organization) ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {[item.target_ward, item.target_organization].filter(Boolean).join(' \u00B7 ')}
          </Text>
        ) : null}

        {individualsText ? (
          <Text style={styles.individualsText} numberOfLines={1}>{individualsText}</Text>
        ) : null}

        <View style={styles.cardMeta}>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.text }]} />
            <Text style={[styles.statusText, { color: colors.text }]}>{item.status_label}</Text>
          </View>
          <View style={[styles.scopeChip, { backgroundColor: item.scope === 'stake' ? '#016183' + '15' : '#0F766E15' }]}>
            <Text style={[styles.scopeChipText, { color: item.scope === 'stake' ? '#016183' : '#0F766E' }]}>
              {item.scope === 'stake' ? 'Stake' : 'Ward'}
            </Text>
          </View>
          <Text style={styles.timeText}>{relativeTime(item.updated_at)}</Text>
        </View>

        {item.status === 'in_progress' && item.steps_progress != null && (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, item.steps_progress)}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(item.steps_progress)}%</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function CallingsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const [statusFilter, setStatusFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'' | 'stake' | 'ward'>('');
  const [mineOnly, setMineOnly] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (statusFilter) p.status = statusFilter;
    if (scopeFilter) p.scope = scopeFilter;
    if (mineOnly) p.mine_only = 'true';
    return p;
  }, [statusFilter, scopeFilter, mineOnly]);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<{ calling_requests?: CallingRequestListItem[]; data?: CallingRequestListItem[] }>({
    queryKey: ['/api/calling-requests', queryParams],
    queryFn: () => authFetch(token, '/api/calling-requests', { params: queryParams }),
    enabled: !!token,
    staleTime: 30000,
  });

  const { data: pendingData, refetch: refetchPending } = useQuery<{ pending_action_count: number }>({
    queryKey: ['/api/calling-requests/pending-action-count'],
    queryFn: () => authFetch(token, '/api/calling-requests/pending-action-count'),
    enabled: !!token,
    staleTime: 30000,
  });

  const items: CallingRequestListItem[] = data?.calling_requests || data?.data || [];
  const pendingCount = pendingData?.pending_action_count || 0;

  const handleRefresh = useCallback(() => {
    refetch();
    refetchPending();
  }, [refetch, refetchPending]);

  const handleScopeToggle = useCallback((scope: '' | 'stake' | 'ward') => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setScopeFilter(prev => prev === scope ? '' : scope);
  }, []);

  const selectedStatusLabel = STATUS_OPTIONS.find(s => s.value === statusFilter)?.label || 'All Statuses';

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <ListCardSkeleton count={5} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
        <Text style={styles.errorTitle}>Unable to load requests</Text>
        <Pressable onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.filterSection}>
        {pendingCount > 0 && (
          <View style={styles.pendingBanner}>
            <Ionicons name="alert-circle" size={18} color="#92400e" />
            <Text style={styles.pendingText}>{pendingCount} pending action{pendingCount !== 1 ? 's' : ''}</Text>
          </View>
        )}

        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setShowStatusDropdown(!showStatusDropdown)}
            style={styles.statusDropdownTrigger}
          >
            <Text style={styles.statusDropdownLabel} numberOfLines={1}>{selectedStatusLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={Colors.brand.darkGray} />
          </Pressable>

          <View style={styles.scopeToggles}>
            {(['stake', 'ward'] as const).map(s => (
              <Pressable
                key={s}
                onPress={() => handleScopeToggle(s)}
                style={[styles.scopeToggle, scopeFilter === s && styles.scopeToggleActive]}
              >
                <Text style={[styles.scopeToggleText, scopeFilter === s && styles.scopeToggleTextActive]}>
                  {s === 'stake' ? 'Stake' : 'Ward'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.filterRow2}>
          <View style={styles.mineToggle}>
            <Text style={styles.mineToggleLabel}>My Requests</Text>
            <Switch
              value={mineOnly}
              onValueChange={setMineOnly}
              trackColor={{ false: Colors.brand.lightGray, true: Colors.brand.primary + '60' }}
              thumbColor={mineOnly ? Colors.brand.primary : '#f4f4f5'}
              style={{ transform: [{ scale: 0.8 }] }}
            />
          </View>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/calling-create');
            }}
            style={styles.newButton}
          >
            <Ionicons name="add" size={20} color={Colors.brand.white} />
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        </View>

        {showStatusDropdown && (
          <View style={styles.statusDropdownList}>
            {STATUS_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setStatusFilter(opt.value);
                  setShowStatusDropdown(false);
                }}
                style={[styles.statusDropdownItem, statusFilter === opt.value && styles.statusDropdownItemActive]}
              >
                <Text style={[styles.statusDropdownItemText, statusFilter === opt.value && styles.statusDropdownItemTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Animated.View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => <CallingCard item={item} index={index} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + webBottomInset + 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.primary}
            colors={[Colors.brand.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={36} color={Colors.brand.midGray} />
            </View>
            <Text style={styles.emptyTitle}>No calling requests found</Text>
            <Text style={styles.emptyDesc}>
              {statusFilter || scopeFilter || mineOnly
                ? 'Try adjusting your filters.'
                : 'Tap "+ New" to create your first calling request.'}
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
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    marginTop: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.brand.white,
    fontSize: 14,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  filterSection: {
    backgroundColor: Colors.brand.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brand.lightGray,
    marginBottom: 4,
    ...contentContainer,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400e',
    fontFamily: 'Inter_600SemiBold',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statusDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    gap: 6,
    flex: 1,
  },
  statusDropdownLabel: {
    fontSize: 13,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  statusDropdownList: {
    backgroundColor: Colors.brand.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    marginTop: 6,
    overflow: 'hidden',
  },
  statusDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  statusDropdownItemActive: {
    backgroundColor: Colors.brand.accent,
  },
  statusDropdownItemText: {
    fontSize: 13,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  statusDropdownItemTextActive: {
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  scopeToggles: {
    flexDirection: 'row',
    gap: 4,
  },
  scopeToggle: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.brand.sectionBg,
  },
  scopeToggleActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  scopeToggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
  },
  scopeToggleTextActive: {
    color: Colors.brand.white,
  },
  mineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mineToggleLabel: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_500Medium',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 4,
  },
  newButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    ...contentContainer,
  },
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...cardShadow(),
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  individualsText: {
    fontSize: 13,
    color: Colors.brand.primary,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  scopeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  scopeChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  timeText: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.brand.lightGray,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.brand.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
    width: 30,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.brand.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.brand.midGray,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
});

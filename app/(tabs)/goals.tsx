import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { getApiUrl } from '@/lib/query-client';
import { ListCardSkeleton } from '@/components/Skeleton';
import Colors from '@/constants/colors';
import { contentContainer, cardShadow } from '@/constants/styles';

interface GoalPeriod {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface Goal {
  id: number;
  title: string;
  description: string;
  scope: string;
  status: string;
  display_status: string;
  progress: number;
  focus_area: string;
  ward: string | null;
  organization: string | null;
  council: string | null;
  created_by: string;
  pi_count: number;
  pi_completed_count: number;
  created_at: string;
}

interface GoalsResponse {
  success: boolean;
  period: GoalPeriod;
  goals: Goal[];
  meta: { total: number; by_scope: Record<string, number> };
}

type ScopeFilter = 'all' | 'stake' | 'ward' | 'organization' | 'committee';

const SCOPE_LABELS: { key: ScopeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'stake', label: 'Stake' },
  { key: 'ward', label: 'Ward' },
  { key: 'organization', label: 'Org' },
  { key: 'committee', label: 'Committee' },
];

function scopeColor(scope: string): string {
  switch (scope) {
    case 'stake': return '#016183';
    case 'ward': return '#0F766E';
    case 'organization': return '#7C3AED';
    case 'committee': return '#D97706';
    default: return Colors.brand.midGray;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'active': return Colors.brand.success;
    case 'draft': return Colors.brand.warning;
    case 'completed': return '#6366F1';
    case 'archived': return Colors.brand.midGray;
    default: return Colors.brand.midGray;
  }
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  return (
    <View style={pStyles.track}>
      <View style={[pStyles.fill, { width: `${clampedProgress}%`, backgroundColor: color }]} />
    </View>
  );
}

const pStyles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: Colors.brand.lightGray,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});

function GoalCard({ goal, index }: { goal: Goal; index: number }) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({ pathname: '/goal-detail', params: { goalId: String(goal.id) } });
  };

  const sColor = scopeColor(goal.scope);
  const completedRatio = goal.pi_count > 0
    ? `${goal.pi_completed_count}/${goal.pi_count}`
    : '0';

  return (
    <Animated.View entering={FadeInDown.duration(350).delay(80 + index * 60)}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        testID={`goal-card-${goal.id}`}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.scopeBadge, { backgroundColor: sColor + '18' }]}>
            <Text style={[styles.scopeText, { color: sColor }]}>
              {goal.scope.charAt(0).toUpperCase() + goal.scope.slice(1)}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColor(goal.display_status.toLowerCase()) }]} />
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{goal.title}</Text>

        {goal.focus_area ? (
          <View style={styles.focusRow}>
            <Ionicons name="leaf-outline" size={13} color={Colors.brand.midGray} />
            <Text style={styles.focusText}>{goal.focus_area}</Text>
          </View>
        ) : null}

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressPercent}>{Math.round(goal.progress)}%</Text>
          </View>
          <ProgressBar progress={goal.progress} color={sColor} />
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <MaterialCommunityIcons name="flag-checkered" size={14} color={Colors.brand.midGray} />
            <Text style={styles.footerText}>{completedRatio} indicators</Text>
          </View>
          {(goal.organization || goal.ward || goal.council) ? (
            <View style={styles.footerItem}>
              <MaterialCommunityIcons name="account-group-outline" size={14} color={Colors.brand.midGray} />
              <Text style={styles.footerText} numberOfLines={1}>
                {goal.organization || goal.council || goal.ward}
              </Text>
            </View>
          ) : (
            <View style={styles.footerItem}>
              <MaterialCommunityIcons name="office-building-outline" size={14} color={Colors.brand.midGray} />
              <Text style={styles.footerText}>{goal.scope}</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [activeScope, setActiveScope] = useState<ScopeFilter>('all');
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<GoalsResponse>({
    queryKey: ['/api/goals', activeScope],
    queryFn: async () => {
      const base = getApiUrl();
      const params = new URLSearchParams();
      if (activeScope !== 'all') params.set('scope', activeScope);
      params.set('status', 'active');
      params.set('period_id', '7');
      const url = `${base}api/goals?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Failed to load goals');
      return res.json();
    },
    enabled: !!token,
    staleTime: 60000,
  });

  const handleScopeChange = useCallback((scope: ScopeFilter) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setActiveScope(scope);
  }, []);

  const goals = data?.goals || [];
  const period = data?.period;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <ListCardSkeleton count={4} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
          <Text style={styles.errorTitle}>Unable to load goals</Text>
          <Text style={styles.errorDescription}>Check your connection and try again.</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(300)}>
        {period && (
          <View style={styles.periodBanner}>
            <Ionicons name="calendar-outline" size={15} color={Colors.brand.primary} />
            <Text style={styles.periodText}>{period.name}</Text>
            {period.is_current && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentText}>Current</Text>
              </View>
            )}
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {SCOPE_LABELS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => handleScopeChange(s.key)}
              style={[
                styles.filterChip,
                activeScope === s.key && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  activeScope === s.key && styles.filterLabelActive,
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + webBottomInset + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.brand.primary}
          />
        }
      >
        {goals.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="target" size={36} color={Colors.brand.primary} />
            </View>
            <Text style={styles.emptyTitle}>No goals found</Text>
            <Text style={styles.emptyDescription}>
              {activeScope === 'all'
                ? 'No active goals for your organizations in this period.'
                : `No ${activeScope}-level goals for your entities.`}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultsCount}>
              {goals.length} goal{goals.length !== 1 ? 's' : ''}
            </Text>
            {goals.map((goal, index) => (
              <GoalCard key={goal.id} goal={goal} index={index} />
            ))}
          </>
        )}
      </ScrollView>
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    marginTop: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  errorDescription: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
  periodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  periodText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  currentBadge: {
    backgroundColor: Colors.brand.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.brand.success,
    fontFamily: 'Inter_600SemiBold',
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    ...contentContainer,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.brand.sectionBg,
  },
  filterChipActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_500Medium',
  },
  filterLabelActive: {
    color: Colors.brand.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    ...contentContainer,
  },
  resultsCount: {
    fontSize: 12,
    color: Colors.brand.midGray,
    marginBottom: 12,
    fontFamily: 'Inter_400Regular',
  },
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...cardShadow(),
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scopeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scopeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    fontFamily: 'Inter_600SemiBold',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    lineHeight: 22,
    marginBottom: 6,
    fontFamily: 'Inter_700Bold',
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 14,
  },
  focusText: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  progressSection: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_500Medium',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    fontFamily: 'Inter_700Bold',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brand.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    marginBottom: 6,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
});

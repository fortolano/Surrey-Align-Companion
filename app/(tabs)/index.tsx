import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';

function isHighCouncilor(calling: string | undefined): boolean {
  if (!calling) return false;
  const lower = calling.toLowerCase();
  return lower.includes('high council') || lower.includes('high councilor');
}

interface QuickLink {
  id: string;
  label: string;
  icon: React.ReactNode;
  route: string;
  color: string;
  bgColor: string;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const firstName = user?.name?.split(' ')[0] || 'Leader';

  const { data: stakeBusinessData, refetch: refetchStakeBusiness } = useQuery<{
    success: boolean;
    business_items: Array<{
      id: number;
      created_at: string;
      wards_completed: number[];
      wards_outstanding: number[];
    }>;
  }>({
    queryKey: ['/api/sunday-business/sunday'],
    queryFn: () => authFetch(token, '/api/sunday-business/sunday'),
    enabled: !!token,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });

  const { data: actionRequiredData, refetch: refetchActionRequired } = useQuery<{
    success: boolean;
    action_required?: Array<any>;
    calling_requests?: Array<any>;
    action_items?: Array<any>;
    meta?: { total: number };
    total_count?: number;
  }>({
    queryKey: ['/api/calling-requests/action-required'],
    queryFn: () => authFetch(token, '/api/calling-requests/action-required'),
    enabled: !!token,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const { data: notificationsData, refetch: refetchNotifications } = useQuery<{
    notifications?: Array<any>;
    meta?: { unread_count: number };
  }>({
    queryKey: ['/api/notifications', { unread_only: 'true' }],
    queryFn: () => authFetch(token, '/api/notifications', { params: { unread_only: 'true' } }),
    enabled: !!token,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const handleManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        refetchStakeBusiness(),
        refetchActionRequired(),
        refetchNotifications(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetchStakeBusiness, refetchActionRequired, refetchNotifications]);

  useFocusEffect(
    React.useCallback(() => {
      refetchActionRequired();
      refetchNotifications();
    }, [refetchActionRequired, refetchNotifications])
  );

  const actionItems = useMemo(() => {
    const rawItems = actionRequiredData?.action_required || actionRequiredData?.calling_requests || actionRequiredData?.action_items || [];
    return rawItems.map((ai: any) => ({
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
  }, [actionRequiredData]);

  const actionTotal = actionRequiredData?.meta?.total ?? actionRequiredData?.total_count ?? actionItems.length;

  const showSustainings = isHighCouncilor(user?.calling) || (user?.is_stake_presidency ?? false);

  const sustainingsVoteCount = useMemo(() => {
    return actionItems.filter((i: any) => {
      const label = (i.action_label || '').toLowerCase();
      const type = (i.action_type || '').toLowerCase();
      return type === 'vote' || type === 'recommend' || type === 'sustain' ||
        label.includes('vote') || label.includes('recommendation') ||
        label.includes('sustain') || label.includes('voting');
    }).length;
  }, [actionItems]);

  const outstandingWards = useMemo(() => {
    const items = stakeBusinessData?.business_items || [];
    let total = 0;
    for (const item of items) {
      total += item.wards_outstanding.length;
    }
    return total;
  }, [stakeBusinessData]);

  const unreadNotifCount = notificationsData?.meta?.unread_count ?? 0;

  const statCards = useMemo(() => {
    const cards: Array<{ label: string; value: number; color: string; icon: string }> = [];
    if (actionTotal > 0) {
      cards.push({ label: 'Action Items', value: actionTotal, color: '#B45309', icon: 'flash' });
    }
    if (showSustainings && sustainingsVoteCount > 0) {
      cards.push({ label: 'Sustainings', value: sustainingsVoteCount, color: '#7C3AED', icon: 'hand-left-outline' });
    }
    if (outstandingWards > 0) {
      cards.push({ label: 'Wards Pending', value: outstandingWards, color: Colors.brand.primary, icon: 'business-outline' });
    }
    return cards;
  }, [actionTotal, sustainingsVoteCount, outstandingWards, showSustainings]);

  const primaryLinks: QuickLink[] = useMemo(() => {
    const links: QuickLink[] = [];
    if (showSustainings) {
      links.push({
        id: 'sustainings',
        label: 'Sustainings',
        icon: <Ionicons name="hand-left-outline" size={22} color="#B45309" />,
        route: '/sustainings',
        color: '#B45309',
        bgColor: '#FEF3C7',
      });
    }
    links.push(
      {
        id: 'sunday-business',
        label: 'Sunday Business',
        icon: <MaterialCommunityIcons name="script-text-outline" size={22} color={Colors.brand.primary} />,
        route: '/sunday-business',
        color: Colors.brand.primary,
        bgColor: '#E8F4F8',
      },
      {
        id: 'goals',
        label: 'Goals',
        icon: <MaterialCommunityIcons name="target" size={22} color={Colors.brand.primary} />,
        route: '/goals',
        color: Colors.brand.primary,
        bgColor: '#E8F8EE',
      },
    );
    return links;
  }, [showSustainings]);

  const secondaryLinks: QuickLink[] = [
    {
      id: 'hc-agenda',
      label: 'HC Agenda',
      icon: <MaterialCommunityIcons name="clipboard-text-outline" size={20} color={Colors.brand.primary} />,
      route: '/high-council-agenda',
      color: Colors.brand.primary,
      bgColor: '#E8F0F8',
    },
    {
      id: 'sc-agenda',
      label: 'SC Agenda',
      icon: <Ionicons name="document-text-outline" size={20} color={Colors.brand.primary} />,
      route: '/stake-council-agenda',
      color: Colors.brand.primary,
      bgColor: '#E8F8F0',
    },
    {
      id: 'assignments',
      label: 'Assignments',
      icon: <Feather name="check-square" size={18} color={Colors.brand.primary} />,
      route: '/assignments',
      color: Colors.brand.primary,
      bgColor: '#F0E8F8',
    },
    {
      id: 'pulse',
      label: 'ALIGN Pulse',
      icon: <MaterialCommunityIcons name="pulse" size={20} color={Colors.brand.primary} />,
      route: '/align-pulse',
      color: Colors.brand.primary,
      bgColor: '#F8F0E8',
    },
  ];

  const didAnimateRef = useRef(false);
  const shouldAnimate = !didAnimateRef.current;
  if (!didAnimateRef.current) didAnimateRef.current = true;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hi, {firstName}</Text>
            {user?.calling && (
              <Text style={styles.roleText} numberOfLines={1}>
                {user.calling}{user.ward ? ` \u00B7 ${user.ward}` : ''}
              </Text>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={handleManualRefresh}
            tintColor={Colors.brand.primary}
            colors={[Colors.brand.primary]}
          />
        }
      >
        {statCards.length > 0 && (
          <View style={styles.statsRow}>
            {statCards.map((stat) => (
              <Pressable
                key={stat.label}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (stat.label === 'Sustainings') router.push('/sustainings');
                  else if (stat.label === 'Wards Pending') router.push('/sunday-business');
                  else router.push('/(tabs)/callings' as any);
                }}
                style={({ pressed }) => [
                  styles.statCard,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {actionItems.length > 0 && (
          <View style={arStyles.card}>
            <View style={arStyles.cardHeader}>
              <View style={arStyles.cardHeaderLeft}>
                <Ionicons name="flash" size={16} color="#B45309" />
                <Text style={arStyles.cardHeaderTitle}>Action Required</Text>
              </View>
              <View style={arStyles.countBadge}>
                <Text style={arStyles.countBadgeText}>{actionTotal}</Text>
              </View>
            </View>
            {actionItems.slice(0, 4).map((item, idx) => {
              const individualsText = item.individuals?.map((i: any) => i.name).join(', ') || '';
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/calling-detail', params: { id: String(item.id) } });
                  }}
                  style={({ pressed }) => [
                    arStyles.row,
                    idx === Math.min(actionItems.length, 4) - 1 && arStyles.rowLast,
                    pressed && { opacity: 0.7 },
                  ]}
                  testID={`action-item-${item.id}`}
                >
                  <View style={arStyles.rowContent}>
                    <Text style={arStyles.rowTitle} numberOfLines={1}>
                      {item.target_calling || item.request_type_label}
                    </Text>
                    {individualsText ? (
                      <Text style={arStyles.rowSub} numberOfLines={1}>{individualsText}</Text>
                    ) : null}
                    <View style={arStyles.actionRow}>
                      <Ionicons name="arrow-forward" size={11} color="#B45309" />
                      <Text style={arStyles.actionLabel}>{item.action_label}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.brand.midGray} />
                </Pressable>
              );
            })}
            {actionTotal > 4 && (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/callings' as any);
                }}
                style={({ pressed }) => [arStyles.viewAllBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={arStyles.viewAllText}>View all {actionTotal} items</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.brand.primary} />
              </Pressable>
            )}
          </View>
        )}

        <Text style={styles.sectionLabel}>Quick Access</Text>
        <View style={styles.primaryLinksContainer}>
          {primaryLinks.map((link) => (
            <Pressable
              key={link.id}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(link.route as any);
              }}
              style={({ pressed }) => [
                styles.primaryLink,
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
              testID={`quick-${link.id}`}
            >
              <View style={[styles.primaryLinkIcon, { backgroundColor: link.bgColor }]}>
                {link.icon}
              </View>
              <Text style={styles.primaryLinkLabel}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
            </Pressable>
          ))}
        </View>

        <View style={styles.gridContainer}>
          {secondaryLinks.map((link) => (
            <Pressable
              key={link.id}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(link.route as any);
              }}
              style={({ pressed }) => [
                styles.gridItem,
                pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
              ]}
              testID={`grid-${link.id}`}
            >
              <View style={[styles.gridIcon, { backgroundColor: link.bgColor }]}>
                {link.icon}
              </View>
              <Text style={styles.gridLabel} numberOfLines={2}>{link.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  roleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand.midGray,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  primaryLinksContainer: {
    gap: 8,
    marginBottom: 20,
  },
  primaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryLinkIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryLinkLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  gridItem: {
    width: '48.5%' as any,
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  gridIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
});

const arStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    marginBottom: 20,
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
    backgroundColor: '#FFFBEB',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  countBadge: {
    backgroundColor: '#FEF3C7',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    fontFamily: 'Inter_700Bold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
    gap: 8,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 1,
  },
  rowSub: {
    fontSize: 12,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginBottom: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionLabel: {
    fontSize: 12,
    color: '#B45309',
    fontFamily: 'Inter_500Medium',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.brand.lightGray,
    backgroundColor: '#FEFCE8',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
});

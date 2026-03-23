import React, { useState, useMemo, useCallback } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
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
import * as Haptics from 'expo-haptics';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { useMyAgendaItems } from '@/lib/agenda-api';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import Colors from '@/constants/colors';
import AppListRow from '@/components/ui/AppListRow';
import ScreenHeader from '@/components/ScreenHeader';
import AvatarMenu from '@/components/AvatarMenu';

function isHighCouncilor(user: any): boolean {
  return user?.is_high_councilor === true;
}

interface QuickLink {
  id: string;
  label: string;
  icon: React.ReactNode;
  route: string;
  color: string;
  bgColor: string;
  badge?: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const firstName = user?.name?.split(' ')[0] || 'Leader';

  const { data: actionRequiredData, isError: actionRequiredError, refetch: refetchActionRequired } = useQuery<{
    success: boolean;
    action_required?: any[];
    calling_requests?: any[];
    action_items?: any[];
    meta?: { total: number };
    total_count?: number;
  }>({
    queryKey: ['/api/calling-requests/action-required'],
    queryFn: () => authFetch(token, '/api/calling-requests/action-required'),
    enabled: !!token,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const { refetch: refetchNotifications } = useQuery<{
    notifications?: any[];
    meta?: { unread_count: number };
  }>({
    queryKey: ['/api/notifications', { unread_only: 'true' }],
    queryFn: () => authFetch(token, '/api/notifications', { params: { unread_only: 'true' } }),
    enabled: !!token,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const canSeeSpeaking =
    (user?.is_stake_presidency_member ?? false) ||
    (user?.is_high_councilor ?? false) ||
    (user?.is_stake_council_member ?? false) ||
    (user?.is_stake_org_presidency_member ?? false) ||
    (user?.is_stake_director ?? false);

  const { data: speakingBadgeData, refetch: refetchSpeakingBadge } = useQuery<{ pending_action_count?: number }>({
    queryKey: ['speaking-badge'],
    queryFn: () => authFetch(token, '/api/speaking-assignments/pending-action-count'),
    enabled: !!token && canSeeSpeaking,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });

  const speakingBadgeCount = speakingBadgeData?.pending_action_count ?? 0;

  const { data: agendaItemsData, refetch: refetchAgendaItems } = useMyAgendaItems();
  const agendaItemCount = agendaItemsData?.items?.length ?? 0;

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const handleManualRefresh = useCallback(async () => {
    triggerGlobalRefreshIndicator();
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        refetchActionRequired(),
        refetchNotifications(),
        refetchAgendaItems(),
        ...(canSeeSpeaking ? [refetchSpeakingBadge()] : []),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetchActionRequired, refetchNotifications, refetchAgendaItems, canSeeSpeaking, refetchSpeakingBadge]);

  useFocusEffect(
    React.useCallback(() => {
      refetchActionRequired();
      refetchNotifications();
      refetchAgendaItems();
      if (canSeeSpeaking) refetchSpeakingBadge();
    }, [refetchActionRequired, refetchNotifications, refetchAgendaItems, canSeeSpeaking, refetchSpeakingBadge])
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

  const canSeeSustainings =
    (user?.is_high_councilor ?? false) ||
    (user?.is_stake_presidency_member ?? false) ||
    (user?.is_executive_secretary ?? false) ||
    (user?.is_bishopric_member ?? false);

  const canSeeSundayBusiness = canSeeSustainings;

  const canSeeCallings =
    canSeeSustainings ||
    (user?.is_ward_org_president ?? false) ||
    (user?.is_stake_org_president ?? false);

  const userIsHC = isHighCouncilor(user);

  const sustainingItems = useMemo(() => {
    return actionItems.filter((item: any) => {
      const label = (item.action_label || '').toLowerCase();
      const type = (item.action_type || '').toLowerCase();
      return type === 'vote' || type === 'recommend' || type === 'sustain' ||
        label.includes('vote') || label.includes('recommendation') ||
        label.includes('sustain') || label.includes('voting');
    });
  }, [actionItems]);

  const nonSustainingItems = useMemo(() => {
    return actionItems.filter((item: any) => {
      const label = (item.action_label || '').toLowerCase();
      const type = (item.action_type || '').toLowerCase();
      return !(type === 'vote' || type === 'recommend' || type === 'sustain' ||
        label.includes('vote') || label.includes('recommendation') ||
        label.includes('sustain') || label.includes('voting'));
    });
  }, [actionItems]);

  const topActionItem = useMemo(() => {
    if (userIsHC && sustainingItems.length > 0) {
      return { item: sustainingItems[0], total: sustainingItems.length, isSustaining: true };
    }
    if (nonSustainingItems.length > 0) {
      return { item: nonSustainingItems[0], total: nonSustainingItems.length, isSustaining: false };
    }
    if (actionItems.length > 0) {
      return { item: actionItems[0], total: actionItems.length, isSustaining: false };
    }
    return null;
  }, [actionItems, sustainingItems, nonSustainingItems, userIsHC]);

  const primaryLinks: QuickLink[] = useMemo(() => {
    const links: QuickLink[] = [];
    if (canSeeSustainings) {
      links.push({
        id: 'sustainings',
        label: 'Sustainings',
        icon: <Ionicons name="hand-left-outline" size={22} color="#B45309" />,
        route: '/sustainings',
        color: '#B45309',
        bgColor: '#FEF3C7',
      });
    }
    if (canSeeCallings) {
      links.push({
        id: 'callings',
        label: 'Callings',
        icon: <Ionicons name="people-outline" size={22} color={Colors.brand.primary} />,
        route: '/callings',
        color: Colors.brand.primary,
        bgColor: '#E8F4F8',
      });
    }
    if (canSeeSundayBusiness) {
      links.push({
        id: 'sunday-business',
        label: 'Sunday Business',
        icon: <MaterialCommunityIcons name="script-text-outline" size={22} color={Colors.brand.primary} />,
        route: '/sunday-business',
        color: Colors.brand.primary,
        bgColor: '#E8F4F8',
      });
    }
    links.push({
      id: 'goals',
      label: 'Goals',
      icon: <MaterialCommunityIcons name="target" size={22} color={Colors.brand.primary} />,
      route: '/goals',
      color: Colors.brand.primary,
      bgColor: '#E8F8EE',
    });
    return links;
  }, [canSeeSustainings, canSeeCallings, canSeeSundayBusiness]);

  const secondaryLinks: QuickLink[] = useMemo(() => {
    const links: QuickLink[] = [];
    const canSeeHCAgenda = (user?.is_stake_presidency_member ?? false) || (user?.is_high_councilor ?? false);
    const canSeeSCAgenda = (user?.is_stake_presidency_member ?? false) || (user?.is_stake_council_member ?? false);

    if (canSeeHCAgenda) {
      links.push({
        id: 'hc-agenda',
        label: 'HC Agenda',
        icon: <MaterialCommunityIcons name="clipboard-text-outline" size={20} color={Colors.brand.primary} />,
        route: '/high-council-agenda',
        color: Colors.brand.primary,
        bgColor: '#E8F0F8',
      });
    }
    if (canSeeSCAgenda) {
      links.push({
        id: 'sc-agenda',
        label: 'SC Agenda',
        icon: <Ionicons name="document-text-outline" size={20} color={Colors.brand.primary} />,
        route: '/stake-council-agenda',
        color: Colors.brand.primary,
        bgColor: '#E8F8F0',
      });
    }
    if (canSeeSpeaking) {
      links.push({
        id: 'speaking',
        label: 'Speaking',
        icon: <Ionicons name="mic-outline" size={20} color={Colors.brand.primary} />,
        route: '/speaking-assignments',
        color: Colors.brand.primary,
        bgColor: '#F0F4E8',
        badge: speakingBadgeCount > 0 ? speakingBadgeCount : undefined,
      });
    }
    links.push(
      {
        id: 'assignments',
        label: 'Immediate Tasks',
        icon: <Feather name="check-square" size={18} color={Colors.brand.primary} />,
        route: '/assignments',
        color: Colors.brand.primary,
        bgColor: '#F0E8F8',
        badge: (actionItems.length + agendaItemCount) > 0 ? actionItems.length + agendaItemCount : undefined,
      },
      {
        id: 'pulse',
        label: 'ALIGN Pulse',
        icon: <MaterialCommunityIcons name="pulse" size={20} color={Colors.brand.primary} />,
        route: '/align-pulse',
        color: Colors.brand.primary,
        bgColor: '#F8F0E8',
      },
    );
    return links;
  }, [user, actionItems, canSeeSpeaking, speakingBadgeCount, agendaItemCount]);



  return (
    <View style={styles.container}>
      <ScreenHeader
        title={`Hi, ${firstName}`}
        subtitle={user?.calling ? `${user.calling}${user.ward ? ` \u00B7 ${user.ward}` : ''}` : undefined}
        rightElement={<AvatarMenu />}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
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
        {topActionItem ? (
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (topActionItem.isSustaining) {
                router.push('/sustainings');
              } else {
                router.push({ pathname: '/calling-detail', params: { id: String(topActionItem.item.id) } });
              }
            }}
            style={({ pressed }) => [
              doStyles.card,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            testID="do-this-now-card"
          >
            <View style={doStyles.cardHeader}>
              <View style={doStyles.iconCircle}>
                <Ionicons name={topActionItem.isSustaining ? 'hand-left-outline' : 'flash'} size={18} color="#B45309" />
              </View>
              <View style={doStyles.headerText}>
                <Text style={doStyles.cardTitle}>
                  {topActionItem.isSustaining ? 'Provide Your Sustaining' : 'Do This Now'}
                </Text>
                {topActionItem.total > 1 && (
                  <Text style={doStyles.cardCount}>+{topActionItem.total - 1} more</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
            </View>
            <View style={doStyles.cardBody}>
              <Text style={doStyles.callingName} numberOfLines={1}>
                {topActionItem.item.target_calling || topActionItem.item.request_type_label}
              </Text>
              {topActionItem.item.individuals?.length > 0 && (
                <Text style={doStyles.individualsText} numberOfLines={1}>
                  {topActionItem.item.individuals.map((i: any) => i.name).join(', ')}
                </Text>
              )}
              <View style={doStyles.actionChip}>
                <Ionicons name="arrow-forward" size={12} color={Colors.brand.white} />
                <Text style={doStyles.actionChipText}>{topActionItem.item.action_label}</Text>
              </View>
            </View>
          </Pressable>
        ) : actionRequiredError ? (
          <View style={doStyles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={28} color={Colors.brand.midGray} />
            <Text style={doStyles.emptyText}>Unable to load actions. Pull down to retry.</Text>
          </View>
        ) : (
          <View style={doStyles.emptyCard}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.brand.success} />
            <Text style={doStyles.emptyText}>You&apos;re all caught up!</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Quick Access</Text>
        <View style={styles.primaryLinksCard}>
          {primaryLinks.map((link, index) => (
            <View key={link.id}>
              <AppListRow
                title={link.label}
                left={<View style={[styles.primaryLinkIcon, { backgroundColor: link.bgColor }]}>{link.icon}</View>}
                right={<Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(link.route as any);
                }}
                testID={`quick-${link.id}`}
              />
              {index < primaryLinks.length - 1 ? <View style={styles.primaryLinkDivider} /> : null}
            </View>
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
                {link.badge != null && link.badge > 0 && (
                  <View style={styles.tileBadge}>
                    <Text style={styles.tileBadgeText}>{link.badge > 99 ? '99+' : link.badge}</Text>
                  </View>
                )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.midGray,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  primaryLinksCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  primaryLinkDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.brand.lightGray,
    marginLeft: 70,
  },
  primaryLinkIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 2, 8),
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
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  tileBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Colors.brand.error,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tileBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});

const doStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    fontFamily: 'Inter_700Bold',
  },
  cardCount: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    marginLeft: 46,
  },
  callingName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  individualsText: {
    fontSize: 15,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#B45309',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    marginTop: 4,
  },
  actionChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    marginBottom: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
  },
});

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
import { useAgendaEntities, useMyAgendaItems, type AgendaEntityCard } from '@/lib/agenda-api';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import { withReturnTarget } from '@/lib/navigation-return-target';
import Colors from '@/constants/colors';
import AppListRow from '@/components/ui/AppListRow';
import ScreenHeader from '@/components/ScreenHeader';
import AvatarMenu from '@/components/AvatarMenu';
import BishopHomeScreen from '@/components/BishopHomeScreen';

function isHighCouncilor(user: any): boolean {
  return user?.is_high_councilor === true;
}

function shouldUseBishopHome(user: any): boolean {
  return user?.is_bishop === true || user?.is_executive_secretary === true;
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

function agendaPrimaryTitle(entity: AgendaEntityCard): string {
  const currentTitle = entity.current_agenda_title?.trim();

  if (entity.has_current_agenda && currentTitle) {
    return currentTitle;
  }

  return entity.entity_name;
}

function agendaContextLabel(entity: AgendaEntityCard, primaryTitle: string): string | null {
  return primaryTitle.trim() === entity.entity_name.trim() ? null : entity.entity_name;
}

function agendaMetaLabel(entity: AgendaEntityCard): string {
  if (entity.has_current_agenda) {
    const parts: string[] = [];

    if (entity.current_agenda_status === 'draft') {
      parts.push('Draft');
    } else if (entity.current_agenda_status === 'published') {
      parts.push('Published');
    }

    if (entity.current_agenda_date_label) {
      parts.push(entity.current_agenda_date_label);
    }

    return parts.join(' · ') || 'Meeting agenda';
  }

  if (entity.past_count > 0) {
    const parts = [`${entity.past_count} past agenda${entity.past_count === 1 ? '' : 's'}`];

    if (entity.latest_past_agenda_date_label) {
      parts.push(`Latest ${entity.latest_past_agenda_date_label}`);
    }

    return parts.join(' · ');
  }

  return 'Agenda inbox available';
}

function agendaDateSortValue(date: string | null | undefined): number | null {
  if (!date) return null;

  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? null : parsed;
}

function agendaSortGroup(entity: AgendaEntityCard): number {
  if (entity.has_current_agenda && entity.current_agenda_status === 'published') {
    return 0;
  }

  if (entity.has_current_agenda && entity.current_agenda_status === 'draft') {
    return 1;
  }

  return 2;
}

function AgendaHomeRow({ entity, isLast }: { entity: AgendaEntityCard; isLast: boolean }) {
  const canQuickAdd = Boolean(
    entity.can_submit
      && entity.has_current_agenda
      && entity.current_agenda_status === 'draft'
      && entity.current_agenda_id,
  );
  const primaryTitle = agendaPrimaryTitle(entity);
  const contextLabel = agendaContextLabel(entity, primaryTitle);
  const metaLabel = agendaMetaLabel(entity);

  return (
    <View>
      <View style={styles.agendaCardRow}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(withReturnTarget('/agenda-entity', '/', {
              entityType: entity.entity_type,
              entityId: String(entity.entity_id),
              tab: entity.has_current_agenda ? 'current' : 'past',
              agendaId: entity.has_current_agenda
                ? (entity.current_agenda_id ?? undefined)
                : (entity.latest_past_agenda_id ?? undefined),
            }));
          }}
          style={({ pressed }) => [
            styles.agendaCardMain,
            pressed && styles.agendaCardMainPressed,
          ]}
          accessibilityRole="button"
          testID={`agenda-card-${entity.entity_type}-${entity.entity_id}`}
        >
          <View style={[
            styles.primaryLinkIcon,
            { backgroundColor: entity.entity_kind === 'organization' ? '#F3E8FF' : '#E8F8F0' },
          ]}>
            <MaterialCommunityIcons
              name={entity.entity_kind === 'organization' ? 'account-group-outline' : 'clipboard-text-outline'}
              size={20}
              color={Colors.brand.primary}
            />
          </View>
          <View style={styles.agendaCardBody}>
            {contextLabel ? (
              <Text style={styles.agendaCardContext} numberOfLines={1}>{contextLabel}</Text>
            ) : null}
            <Text style={styles.agendaCardTitle}>{primaryTitle}</Text>
            <Text style={styles.agendaCardMeta} numberOfLines={1}>{metaLabel}</Text>
          </View>
          <View style={styles.agendaRowRight}>
            <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
          </View>
        </Pressable>

        {canQuickAdd ? (
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(withReturnTarget('/agenda-submit', '/', {
                entityType: entity.entity_type,
                entityId: String(entity.entity_id),
                agendaId: entity.current_agenda_id ?? undefined,
                mode: 'specific',
              }));
            }}
            style={({ pressed }) => [
              styles.agendaQuickAddBtn,
              pressed && styles.agendaQuickAddBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Add topic to ${entity.entity_name}`}
            testID={`agenda-quick-add-${entity.entity_type}-${entity.entity_id}`}
          >
            <Ionicons name="add" size={18} color={Colors.brand.primary} />
          </Pressable>
        ) : null}
      </View>
      {!isLast ? <View style={styles.agendaCardDivider} /> : null}
    </View>
  );
}

function GenericHomeScreen() {
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
  const { data: agendaEntitiesData, refetch: refetchAgendaEntities } = useAgendaEntities();
  const sortedAgendaEntities = useMemo(() => {
    return (agendaEntitiesData?.entities ?? [])
      .map((entity, index) => ({ entity, index }))
      .sort((left, right) => {
        const groupDifference = agendaSortGroup(left.entity) - agendaSortGroup(right.entity);
        if (groupDifference !== 0) {
          return groupDifference;
        }

        const leftDate = agendaDateSortValue(left.entity.current_agenda_date);
        const rightDate = agendaDateSortValue(right.entity.current_agenda_date);

        if (leftDate != null || rightDate != null) {
          if (leftDate == null) return 1;
          if (rightDate == null) return -1;
          if (leftDate !== rightDate) return leftDate - rightDate;
        }

        return left.index - right.index;
      })
      .map(({ entity }) => entity);
  }, [agendaEntitiesData?.entities]);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const handleManualRefresh = useCallback(async () => {
    triggerGlobalRefreshIndicator();
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        refetchActionRequired(),
        refetchNotifications(),
        refetchAgendaItems(),
        refetchAgendaEntities(),
        ...(canSeeSpeaking ? [refetchSpeakingBadge()] : []),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetchActionRequired, refetchNotifications, refetchAgendaItems, refetchAgendaEntities, canSeeSpeaking, refetchSpeakingBadge]);

  useFocusEffect(
    React.useCallback(() => {
      refetchActionRequired();
      refetchNotifications();
      refetchAgendaItems();
      refetchAgendaEntities();
      if (canSeeSpeaking) refetchSpeakingBadge();
    }, [refetchActionRequired, refetchNotifications, refetchAgendaItems, refetchAgendaEntities, canSeeSpeaking, refetchSpeakingBadge])
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
  }, [actionItems, canSeeSpeaking, speakingBadgeCount, agendaItemCount]);



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
                router.push(withReturnTarget('/sustainings', '/'));
              } else {
                router.push(withReturnTarget('/calling-detail', '/', { id: String(topActionItem.item.id) }));
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
                  router.push(withReturnTarget(link.route, '/'));
                }}
                testID={`quick-${link.id}`}
              />
              {index < primaryLinks.length - 1 ? <View style={styles.primaryLinkDivider} /> : null}
            </View>
          ))}
        </View>

        {sortedAgendaEntities.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Meeting Agendas</Text>
            <View style={styles.primaryLinksCard}>
              {sortedAgendaEntities.map((entity, index) => (
                <AgendaHomeRow
                  key={`${entity.entity_type}-${entity.entity_id}`}
                  entity={entity}
                  isLast={index === sortedAgendaEntities.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.gridContainer}>
          {secondaryLinks.map((link) => (
            <Pressable
              key={link.id}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(withReturnTarget(link.route, '/'));
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

export default function HomeScreen() {
  const { user } = useAuth();

  if (shouldUseBishopHome(user)) {
    return <BishopHomeScreen mode="home-tab" fallback={<GenericHomeScreen />} />;
  }

  return <GenericHomeScreen />;
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
  agendaRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agendaCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  agendaCardMain: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 14,
  },
  agendaCardMainPressed: {
    backgroundColor: Colors.brand.offWhite,
    opacity: 0.92,
  },
  agendaCardBody: {
    flex: 1,
  },
  agendaCardContext: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
    marginBottom: 2,
  },
  agendaCardTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  agendaCardMeta: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  agendaQuickAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.offWhite,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  agendaQuickAddBtnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  agendaCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.brand.lightGray,
    marginLeft: 78,
    marginRight: 16,
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

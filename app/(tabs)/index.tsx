import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
  Modal,
  Alert,
  Dimensions,
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
  const { user, token, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const firstName = user?.name?.split(' ')[0] || 'Leader';
  const initials = (user?.name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

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
        refetchActionRequired(),
        refetchNotifications(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetchActionRequired, refetchNotifications]);

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

  const showSustainings = isHighCouncilor(user?.calling) || (user?.is_stake_presidency ?? false);
  const userIsHC = isHighCouncilor(user?.calling);

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
        id: 'callings',
        label: 'Callings',
        icon: <Ionicons name="people-outline" size={22} color={Colors.brand.primary} />,
        route: '/(tabs)/callings',
        color: Colors.brand.primary,
        bgColor: '#E8F4F8',
      },
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

  const handleLogout = () => {
    setMenuVisible(false);
    if (Platform.OS === 'web') {
      logout();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
      ]);
    }
  };

  const menuItems = [
    { id: 'profile', label: 'Profile', icon: 'person-outline' as const, route: '/profile' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline' as const, route: '/settings' },
    { id: 'align', label: 'About ALIGN', icon: 'compass-outline' as const, route: '/align-info' },
    { id: 'about', label: 'About This App', icon: 'information-circle-outline' as const, route: '/about-app' },
  ];

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
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMenuVisible(true);
            }}
            style={({ pressed }) => [
              styles.avatarBtn,
              pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
            ]}
            testID="avatar-menu-btn"
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>
      </View>

      {menuVisible && (
        <Modal
          visible={menuVisible}
          transparent
          animationType="none"
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable
            style={menuStyles.overlay}
            onPress={() => setMenuVisible(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={({ pressed }) => []}
            >
              <Animated.View
                entering={FadeIn.duration(150)}
                style={[
                  menuStyles.dropdown,
                  { top: insets.top + webTopInset + 52, right: 16 },
                ]}
              >
              <View style={menuStyles.profileRow}>
                <View style={menuStyles.profileAvatar}>
                  <Text style={menuStyles.profileAvatarText}>{initials}</Text>
                </View>
                <View style={menuStyles.profileInfo}>
                  <Text style={menuStyles.profileName} numberOfLines={1}>{user?.name || 'User'}</Text>
                  {user?.calling && <Text style={menuStyles.profileRole} numberOfLines={1}>{user.calling}</Text>}
                </View>
              </View>

              <View style={menuStyles.divider} />

              {menuItems.map((item, idx) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMenuVisible(false);
                    setTimeout(() => router.push(item.route as any), 150);
                  }}
                  style={({ pressed }) => [
                    menuStyles.menuItem,
                    idx < menuItems.length - 1 && menuStyles.menuItemBorder,
                    pressed && menuStyles.menuItemPressed,
                  ]}
                >
                  <Ionicons name={item.icon} size={18} color={Colors.brand.darkGray} />
                  <Text style={menuStyles.menuLabel}>{item.label}</Text>
                </Pressable>
              ))}

              <View style={menuStyles.divider} />

              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                  menuStyles.menuItem,
                  pressed && menuStyles.menuItemPressed,
                ]}
              >
                <Ionicons name="log-out-outline" size={18} color={Colors.brand.error} />
                <Text style={[menuStyles.menuLabel, { color: Colors.brand.error }]}>Sign Out</Text>
              </Pressable>
              </Animated.View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

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
        ) : (
          <View style={doStyles.emptyCard}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.brand.success} />
            <Text style={doStyles.emptyText}>You're all caught up!</Text>
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
    marginRight: 12,
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
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
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

const doStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
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
    fontSize: 12,
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
    fontSize: 13,
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
    fontSize: 12,
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
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
  },
});

const menuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dropdown: {
    position: 'absolute',
    width: 230,
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  profileRole: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.brand.lightGray,
    marginHorizontal: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
    marginHorizontal: 0,
  },
  menuItemPressed: {
    backgroundColor: Colors.brand.offWhite,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
});

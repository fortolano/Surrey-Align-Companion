import React, { useState, useRef, useMemo } from 'react';
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
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';

interface BadgeInfo {
  label: string;
  count: number;
  color: string;
  bgColor: string;
}

interface TileData {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  color: string;
}

const TILES: TileData[] = [
  {
    id: 'callings',
    title: 'Callings & Releases',
    description: 'Browse current callings by ward and organization',
    icon: <Ionicons name="people-outline" size={26} color="#016183" />,
    route: '/callings',
    color: '#E8F4F8',
  },
  {
    id: 'stake-business',
    title: 'Sunday Business',
    description: 'Conduct releases and sustainings in wards',
    icon: <MaterialCommunityIcons name="script-text-outline" size={26} color="#016183" />,
    route: '/sunday-business',
    color: '#F0F4E8',
  },
  {
    id: 'hc-agenda',
    title: 'High Council Agenda',
    description: 'View and manage High Council meeting agendas',
    icon: <MaterialCommunityIcons name="clipboard-text-outline" size={26} color="#016183" />,
    route: '/high-council-agenda',
    color: '#E8F0F8',
  },
  {
    id: 'sc-agenda',
    title: 'Stake Council Agenda',
    description: 'View and manage Stake Council meeting agendas',
    icon: <Ionicons name="document-text-outline" size={26} color="#016183" />,
    route: '/stake-council-agenda',
    color: '#E8F8F0',
  },
  {
    id: 'assignments',
    title: 'My Assignments',
    description: 'Track your tasks, deadlines, and stewardship areas',
    icon: <Feather name="check-square" size={24} color="#016183" />,
    route: '/assignments',
    color: '#F0E8F8',
  },
  {
    id: 'goals',
    title: 'Goals & Execution',
    description: 'Track stake and ward goals with progress indicators',
    icon: <MaterialCommunityIcons name="target" size={26} color="#016183" />,
    route: '/goals',
    color: '#E8F8EE',
  },
  {
    id: 'pulse',
    title: 'ALIGN Pulse',
    description: 'Submit your monthly leadership progress check-in',
    icon: <MaterialCommunityIcons name="pulse" size={26} color="#016183" />,
    route: '/align-pulse',
    color: '#F8F0E8',
  },
];

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  iconSet: 'ionicons' | 'feather';
  route?: string;
  action?: 'logout';
  destructive?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'profile', label: 'Profile', icon: 'person-outline', iconSet: 'ionicons', route: '/profile' },
  { id: 'align', label: 'ALIGN', icon: 'compass-outline', iconSet: 'ionicons', route: '/align-info' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', iconSet: 'ionicons', route: '/settings' },
  { id: 'about', label: 'About this App', icon: 'information-circle-outline', iconSet: 'ionicons', route: '/about-app' },
  { id: 'tos', label: 'Terms of Service', icon: 'document-text-outline', iconSet: 'ionicons', route: '/terms' },
  { id: 'logout', label: 'Sign Out', icon: 'log-out', iconSet: 'feather', action: 'logout', destructive: true },
];

function FeatureTile({ tile, index, badges }: { tile: TileData; index: number; badges?: BadgeInfo[] }) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(tile.route as any);
  };

  const activeBadges = badges?.filter(b => b.count > 0) || [];

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(100 + index * 80)}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.tile,
          activeBadges.length > 0 && styles.tileWithBadges,
          pressed && styles.tilePressed,
        ]}
        testID={`tile-${tile.id}`}
      >
        <View style={styles.tileMainRow}>
          <View style={[styles.tileIconContainer, { backgroundColor: tile.color }]}>
            {tile.icon}
          </View>
          <View style={styles.tileContent}>
            <Text style={styles.tileTitle}>{tile.title}</Text>
            <Text style={styles.tileDescription}>{tile.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.brand.midGray} />
        </View>
        {activeBadges.length > 0 && (
          <View style={styles.badgeStrip}>
            {activeBadges.map((badge) => (
              <View key={badge.label} style={[styles.badgeBanner, { backgroundColor: badge.bgColor }]}>
                <Ionicons
                  name={badge.label === 'New' ? 'alert-circle' : 'time'}
                  size={15}
                  color={badge.color}
                />
                <Text style={[styles.badgeBannerText, { color: badge.color }]}>
                  {badge.count} {badge.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, token } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const firstName = user?.name?.split(' ')[0] || 'Leader';

  const { data: stakeBusinessData, refetch: refetchStakeBusiness, isRefetching: isRefetchingBusiness } = useQuery<{
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
  });

  const { data: actionRequiredData, refetch: refetchActionRequired, isRefetching: isRefetchingActions } = useQuery<{
    success: boolean;
    calling_requests?: Array<{
      id: number;
      target_calling: string | null;
      request_type_label: string;
      scope: 'stake' | 'ward';
      status: string;
      status_label: string;
      action_label: string;
      action_type: string;
      individuals: Array<{ id: number; name: string; is_selected: boolean }>;
    }>;
    action_items?: Array<{
      calling_request_id: number;
      action_type: string;
      action_label: string;
      calling_name: string;
      status_label: string;
    }>;
    meta?: { total: number };
    total_count?: number;
  }>({
    queryKey: ['/api/calling-requests/action-required'],
    queryFn: () => authFetch(token, '/api/calling-requests/action-required'),
    enabled: !!token,
    staleTime: 60000,
  });

  const { data: notificationsData, refetch: refetchNotifications } = useQuery<{
    notifications?: Array<any>;
    meta?: { unread_count: number };
  }>({
    queryKey: ['/api/notifications', { unread_only: 'true' }],
    queryFn: () => authFetch(token, '/api/notifications', { params: { unread_only: 'true' } }),
    enabled: !!token,
    staleTime: 60000,
  });

  const unreadNotifCount = notificationsData?.meta?.unread_count ?? 0;

  useFocusEffect(
    React.useCallback(() => {
      refetchActionRequired();
      refetchNotifications();
    }, [refetchActionRequired, refetchNotifications])
  );

  const isRefetching = isRefetchingBusiness || isRefetchingActions;

  const stakeBusinessBadges = useMemo<BadgeInfo[]>(() => {
    const items = stakeBusinessData?.business_items || [];
    if (items.length === 0) return [];

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let newCount = 0;
    let outstandingCount = 0;

    for (const item of items) {
      const hasOutstandingWards = item.wards_outstanding.length > 0;
      const createdAt = new Date(item.created_at).getTime();
      const ageMs = now - createdAt;

      if (ageMs <= sevenDaysMs && hasOutstandingWards) {
        newCount++;
      } else if (ageMs > sevenDaysMs && hasOutstandingWards) {
        outstandingCount++;
      }
    }

    return [
      { label: 'New', count: newCount, color: Colors.brand.primary, bgColor: '#E0F2F1' },
      { label: 'Outstanding', count: outstandingCount, color: '#B45309', bgColor: '#FEF3C7' },
    ];
  }, [stakeBusinessData]);

  const actionItems = useMemo(() => {
    if (actionRequiredData?.calling_requests) return actionRequiredData.calling_requests;
    if (actionRequiredData?.action_items) {
      return actionRequiredData.action_items.map(item => ({
        id: item.calling_request_id,
        target_calling: item.calling_name,
        request_type_label: '',
        scope: 'stake' as const,
        status: '',
        status_label: item.status_label,
        action_label: item.action_label,
        action_type: item.action_type,
        individuals: [],
      }));
    }
    return [];
  }, [actionRequiredData]);

  const actionTotal = actionRequiredData?.meta?.total ?? actionRequiredData?.total_count ?? actionItems.length;

  const callingsBadges = useMemo<BadgeInfo[]>(() => {
    const badges: BadgeInfo[] = [];
    if (actionTotal > 0) {
      badges.push({ label: 'Action Needed', count: actionTotal, color: Colors.brand.primary, bgColor: '#E8F4F8' });
    }
    if (unreadNotifCount > 0) {
      badges.push({ label: 'Unread', count: unreadNotifCount, color: '#B45309', bgColor: '#FEF3C7' });
    }
    return badges;
  }, [actionTotal, unreadNotifCount]);

  const handleMenuToggle = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMenuVisible(!menuVisible);
  };

  const handleMenuSelect = (item: MenuItem) => {
    setMenuVisible(false);
    if (item.action === 'logout') {
      if (Platform.OS === 'web') {
        logout().then(() => router.replace('/'));
        return;
      }
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              await logout();
              router.replace('/');
            },
          },
        ],
      );
    } else if (item.route) {
      setTimeout(() => {
        router.push(item.route as any);
      }, 100);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.header, { paddingTop: insets.top + webTopInset + 10 }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{firstName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/notifications');
              }}
              style={({ pressed }) => [
                styles.bellButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
              testID="bell-button"
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.brand.dark} />
              {unreadNotifCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={handleMenuToggle}
              style={({ pressed }) => [
                styles.avatarButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
              testID="menu-button"
            >
              <Text style={styles.avatarText}>
                {(user?.name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </View>
        {user?.calling && (
          <View style={styles.roleChip}>
            <Text style={styles.roleText}>{user.calling}</Text>
            {user.ward && <Text style={styles.wardText}>{user.ward}</Text>}
          </View>
        )}
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
            onRefresh={() => { refetchStakeBusiness(); refetchActionRequired(); refetchNotifications(); }}
            tintColor={Colors.brand.primary}
            colors={[Colors.brand.primary]}
          />
        }
      >
        {actionItems.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(60)} style={arStyles.card}>
            <View style={arStyles.cardHeader}>
              <View style={arStyles.cardHeaderLeft}>
                <Ionicons name="flash" size={18} color="#B45309" />
                <Text style={arStyles.cardHeaderTitle}>Calling Approvals</Text>
              </View>
              <View style={arStyles.countBadge}>
                <Text style={arStyles.countBadgeText}>{actionTotal} need attention</Text>
              </View>
            </View>
            {actionItems.slice(0, 5).map((item, idx) => {
              const isVoteNeeded = item.action_type === 'vote' || item.action_label.toLowerCase().includes('recommendation needed');
              const individualsText = item.individuals?.map(i => i.name).join(', ') || '';
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/calling-detail', params: { id: String(item.id) } });
                  }}
                  style={({ pressed }) => [
                    arStyles.row,
                    isVoteNeeded && arStyles.rowAccent,
                    idx === Math.min(actionItems.length, 5) - 1 && arStyles.rowLast,
                    pressed && { opacity: 0.7 },
                  ]}
                  testID={`action-item-${item.id}`}
                >
                  <View style={arStyles.rowContent}>
                    <Text style={arStyles.rowTitle} numberOfLines={1}>
                      {item.target_calling || item.request_type_label}
                    </Text>
                    {individualsText ? (
                      <Text style={arStyles.rowSub} numberOfLines={1}>
                        {individualsText} · {item.scope === 'stake' ? 'Stake' : 'Ward'}-level
                      </Text>
                    ) : null}
                    <View style={arStyles.actionRow}>
                      <Ionicons name="arrow-forward" size={12} color={isVoteNeeded ? '#B45309' : Colors.brand.midGray} />
                      <Text style={[arStyles.actionLabel, isVoteNeeded && arStyles.actionLabelUrgent]}>
                        {item.action_label}
                      </Text>
                    </View>
                  </View>
                  <View style={arStyles.rowRight}>
                    <Text style={arStyles.statusLabel}>{item.status_label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.brand.midGray} />
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        <Text style={styles.sectionTitle}>Quick Access</Text>
        {TILES.map((tile, index) => (
          <FeatureTile
            key={tile.id}
            tile={tile}
            index={index}
            badges={tile.id === 'stake-business' ? stakeBusinessBadges : tile.id === 'callings' ? callingsBadges : undefined}
          />
        ))}
      </ScrollView>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={[
              styles.menuContainer,
              {
                top: insets.top + webTopInset + 60,
                right: 16,
              },
            ]}
          >
            {MENU_ITEMS.map((item, index) => (
              <React.Fragment key={item.id}>
                {item.destructive && <View style={styles.menuDivider} />}
                <Pressable
                  onPress={() => handleMenuSelect(item)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && styles.menuItemPressed,
                    index === 0 && styles.menuItemFirst,
                    index === MENU_ITEMS.length - 1 && styles.menuItemLast,
                  ]}
                >
                  {item.iconSet === 'feather' ? (
                    <Feather
                      name={item.icon as any}
                      size={18}
                      color={item.destructive ? Colors.brand.error : Colors.brand.dark}
                    />
                  ) : (
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={item.destructive ? Colors.brand.error : Colors.brand.dark}
                    />
                  )}
                  <Text
                    style={[
                      styles.menuLabel,
                      item.destructive && styles.menuLabelDestructive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </Pressable>
      </Modal>
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
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.brand.primary,
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  roleText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontFamily: 'Inter_500Medium',
  },
  wardText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter_400Regular',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.brand.midGray,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 12,
    fontFamily: 'Inter_600SemiBold',
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand.primary,
    paddingLeft: 10,
  },
  tile: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: 'rgba(15, 23, 42, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  tileWithBadges: {
    paddingBottom: 0,
  },
  tileMainRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  tilePressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
  },
  tileIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tileContent: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    marginBottom: 2,
    fontFamily: 'Inter_600SemiBold',
  },
  tileDescription: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  badgeStrip: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.brand.lightGray,
  },
  badgeBanner: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  badgeBannerText: {
    fontSize: 13,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuContainer: {
    position: 'absolute',
    width: 220,
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuItemPressed: {
    backgroundColor: Colors.brand.offWhite,
  },
  menuItemFirst: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  menuItemLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  menuLabel: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  menuLabelDestructive: {
    color: Colors.brand.error,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.brand.lightGray,
  },
});

const arStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: 'rgba(15, 23, 42, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
    backgroundColor: '#FFFBEB',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  countBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#B45309',
    fontFamily: 'Inter_600SemiBold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  rowAccent: {
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  actionLabelUrgent: {
    color: '#B45309',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  statusLabel: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
});

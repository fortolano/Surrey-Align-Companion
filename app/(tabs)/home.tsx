import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';
import { contentContainer, cardShadow } from '@/constants/styles';

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
  isTab?: boolean;
}

const TAB_ROUTES = new Set(['/callings', '/sunday-business', '/goals']);

const TILES: TileData[] = [
  {
    id: 'callings',
    title: 'Callings & Releases',
    description: 'Browse current callings by ward and organization',
    icon: <Ionicons name="people-outline" size={24} color="#016183" />,
    route: '/callings',
    color: '#E8F4F8',
    isTab: true,
  },
  {
    id: 'stake-business',
    title: 'Sunday Business',
    description: 'Conduct releases and sustainings in wards',
    icon: <MaterialCommunityIcons name="church" size={24} color="#016183" />,
    route: '/sunday-business',
    color: '#F0F4E8',
    isTab: true,
  },
  {
    id: 'goals',
    title: 'Goals & Execution',
    description: 'Track stake and ward goals with progress indicators',
    icon: <MaterialCommunityIcons name="target" size={24} color="#016183" />,
    route: '/goals',
    color: '#E8F8EE',
    isTab: true,
  },
  {
    id: 'hc-agenda',
    title: 'High Council Agenda',
    description: 'View and manage High Council meeting agendas',
    icon: <MaterialCommunityIcons name="clipboard-text-outline" size={24} color="#016183" />,
    route: '/high-council-agenda',
    color: '#E8F0F8',
  },
  {
    id: 'sc-agenda',
    title: 'Stake Council Agenda',
    description: 'View and manage Stake Council meeting agendas',
    icon: <Ionicons name="document-text-outline" size={24} color="#016183" />,
    route: '/stake-council-agenda',
    color: '#E8F8F0',
  },
  {
    id: 'assignments',
    title: 'My Assignments',
    description: 'Track your tasks, deadlines, and stewardship areas',
    icon: <Feather name="check-square" size={22} color="#016183" />,
    route: '/assignments',
    color: '#F0E8F8',
  },
  {
    id: 'pulse',
    title: 'ALIGN Pulse',
    description: 'Submit your monthly leadership progress check-in',
    icon: <MaterialCommunityIcons name="pulse" size={24} color="#016183" />,
    route: '/align-pulse',
    color: '#F8F0E8',
  },
];

function FeatureTile({ tile, index, badges }: { tile: TileData; index: number; badges?: BadgeInfo[] }) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (tile.isTab) {
      router.navigate(tile.route as any);
    } else {
      router.push(tile.route as any);
    }
  };

  const activeBadges = badges?.filter(b => b.count > 0) || [];

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(100 + index * 60)}>
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
          <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
        </View>
        {activeBadges.length > 0 && (
          <View style={styles.badgeStrip}>
            {activeBadges.map((badge) => (
              <View key={badge.label} style={[styles.badgeBanner, { backgroundColor: badge.bgColor }]}>
                <Ionicons
                  name={badge.label === 'New' ? 'alert-circle' : 'time'}
                  size={14}
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
  const { user, token } = useAuth();

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

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
    action_items: Array<{
      calling_request_id: number;
      action_type: string;
      action_label: string;
      calling_name: string;
      status_label: string;
    }>;
    total_count: number;
  }>({
    queryKey: ['/api/calling-requests/action-required'],
    queryFn: () => authFetch(token, '/api/calling-requests/action-required'),
    enabled: !!token,
    staleTime: 60000,
  });

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

  const callingsBadges = useMemo<BadgeInfo[]>(() => {
    const count = actionRequiredData?.total_count ?? 0;
    if (count === 0) return [];
    return [
      { label: 'Action Needed', count, color: Colors.brand.primary, bgColor: '#E8F4F8' },
    ];
  }, [actionRequiredData]);

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}
      >
        <View style={[styles.headerInner, contentContainer]}>
          <Text style={styles.greeting}>Welcome, <Text style={styles.userName}>{firstName}</Text></Text>
          {user?.calling && (
            <View style={styles.roleChip}>
              <Text style={styles.roleText}>{user.calling}</Text>
              {user.ward && <Text style={styles.wardText}>{user.ward}</Text>}
            </View>
          )}
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { refetchStakeBusiness(); refetchActionRequired(); }}
            tintColor={Colors.brand.primary}
            colors={[Colors.brand.primary]}
          />
        }
      >
        <View style={contentContainer}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          {TILES.map((tile, index) => (
            <FeatureTile
              key={tile.id}
              tile={tile}
              index={index}
              badges={tile.id === 'stake-business' ? stakeBusinessBadges : tile.id === 'callings' ? callingsBadges : undefined}
            />
          ))}
        </View>
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
    paddingBottom: 14,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    zIndex: 10,
  },
  headerInner: {
    paddingHorizontal: 24,
  },
  greeting: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter_400Regular',
  },
  userName: {
    fontWeight: '700' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  roleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontFamily: 'Inter_500Medium',
  },
  wardText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter_400Regular',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.midGray,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 12,
    fontFamily: 'Inter_600SemiBold',
    paddingLeft: 4,
  },
  tile: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...cardShadow(),
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
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tileContent: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    marginBottom: 2,
    fontFamily: 'Inter_600SemiBold',
  },
  tileDescription: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  badgeStrip: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.brand.lightGray,
  },
  badgeBanner: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
  },
  badgeBannerText: {
    fontSize: 12,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
  },
});

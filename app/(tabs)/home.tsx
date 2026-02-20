import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
  Dimensions,
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

interface BadgeInfo {
  label: string;
  count: number;
  color: string;
}

interface GridTile {
  id: string;
  title: string;
  iconName: string;
  iconSet: 'ionicons' | 'material' | 'feather';
  route: string;
  gradient: [string, string];
  isTab?: boolean;
  badge?: number;
}

const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = 12;
const GRID_PAD = 20;
const TILE_W = (SCREEN_W - GRID_PAD * 2 - GRID_GAP) / 2;

function TileIcon({ iconName, iconSet, size, color }: { iconName: string; iconSet: string; size: number; color: string }) {
  if (iconSet === 'material') return <MaterialCommunityIcons name={iconName as any} size={size} color={color} />;
  if (iconSet === 'feather') return <Feather name={iconName as any} size={size} color={color} />;
  return <Ionicons name={iconName as any} size={size} color={color} />;
}

function GridItem({ tile, index }: { tile: GridTile; index: number }) {
  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tile.isTab) {
      router.navigate(tile.route as any);
    } else {
      router.push(tile.route as any);
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(350).delay(80 + index * 50)} style={styles.gridItemOuter}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.gridItem,
          { backgroundColor: tile.gradient[0] },
          pressed && styles.gridItemPressed,
        ]}
        testID={`tile-${tile.id}`}
      >
        <View style={[styles.gridIconWrap, { backgroundColor: tile.gradient[1] }]}>
          <TileIcon iconName={tile.iconName} iconSet={tile.iconSet} size={22} color="#fff" />
        </View>
        <Text style={styles.gridTitle} numberOfLines={2}>{tile.title}</Text>
        {(tile.badge ?? 0) > 0 && (
          <View style={styles.gridBadge}>
            <Text style={styles.gridBadgeText}>{tile.badge}</Text>
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
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const { data: stakeBusinessData, refetch: refetchStakeBusiness, isRefetching: isRefetchingBusiness } = useQuery<{
    success: boolean;
    business_items: Array<{ id: number; created_at: string; wards_completed: number[]; wards_outstanding: number[] }>;
  }>({
    queryKey: ['/api/sunday-business/sunday'],
    queryFn: () => authFetch(token, '/api/sunday-business/sunday'),
    enabled: !!token,
    staleTime: 60000,
  });

  const { data: actionRequiredData, refetch: refetchActionRequired, isRefetching: isRefetchingActions } = useQuery<{
    success: boolean;
    action_items: Array<{ calling_request_id: number; action_type: string; action_label: string; calling_name: string; status_label: string }>;
    total_count: number;
  }>({
    queryKey: ['/api/calling-requests/action-required'],
    queryFn: () => authFetch(token, '/api/calling-requests/action-required'),
    enabled: !!token,
    staleTime: 60000,
  });

  const isRefetching = isRefetchingBusiness || isRefetchingActions;

  const businessBadgeCount = useMemo(() => {
    const items = stakeBusinessData?.business_items || [];
    return items.filter(i => i.wards_outstanding.length > 0).length;
  }, [stakeBusinessData]);

  const callingsBadgeCount = actionRequiredData?.total_count ?? 0;

  const GRID_TILES: GridTile[] = useMemo(() => [
    {
      id: 'callings', title: 'Callings', iconName: 'people-outline', iconSet: 'ionicons',
      route: '/callings', gradient: ['#EFF6FF', '#3B82F6'], isTab: true, badge: callingsBadgeCount,
    },
    {
      id: 'stake-business', title: 'Sunday Business', iconName: 'church', iconSet: 'material',
      route: '/sunday-business', gradient: ['#FEF3C7', '#F59E0B'], isTab: true, badge: businessBadgeCount,
    },
    {
      id: 'goals', title: 'Goals', iconName: 'target', iconSet: 'material',
      route: '/goals', gradient: ['#ECFDF5', '#10B981'], isTab: true,
    },
    {
      id: 'hc-agenda', title: 'HC Agenda', iconName: 'clipboard-text-outline', iconSet: 'material',
      route: '/high-council-agenda', gradient: ['#EDE9FE', '#8B5CF6'],
    },
    {
      id: 'sc-agenda', title: 'SC Agenda', iconName: 'document-text-outline', iconSet: 'ionicons',
      route: '/stake-council-agenda', gradient: ['#E0F2FE', '#0EA5E9'],
    },
    {
      id: 'assignments', title: 'Assignments', iconName: 'check-square', iconSet: 'feather',
      route: '/assignments', gradient: ['#FCE7F3', '#EC4899'],
    },
    {
      id: 'pulse', title: 'ALIGN Pulse', iconName: 'pulse', iconSet: 'material',
      route: '/align-pulse', gradient: ['#FFF7ED', '#F97316'],
    },
  ], [callingsBadgeCount, businessBadgeCount]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + webTopInset + 12 }]}
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
        <Animated.View entering={FadeIn.duration(350)} style={styles.greetingSection}>
          <View style={styles.greetingRow}>
            <View style={styles.greetingLeft}>
              <Text style={styles.greetingSmall}>Welcome back,</Text>
              <Text style={styles.greetingName}>{firstName}</Text>
            </View>
            <Pressable
              onPress={() => router.navigate('/(tabs)/profile' as any)}
              style={({ pressed }) => [styles.avatarBtn, pressed && { transform: [{ scale: 0.92 }] }]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </Pressable>
          </View>
          {user?.calling && (
            <View style={styles.roleRow}>
              <View style={styles.roleChip}>
                <Ionicons name="shield-checkmark-outline" size={13} color={Colors.brand.primary} />
                <Text style={styles.roleText}>{user.calling}</Text>
              </View>
              {user.ward && (
                <View style={styles.wardChip}>
                  <Ionicons name="location-outline" size={12} color={Colors.brand.midGray} />
                  <Text style={styles.wardText}>{user.ward}</Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        <View style={styles.grid}>
          {GRID_TILES.map((tile, index) => (
            <GridItem key={tile.id} tile={tile} index={index} />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: GRID_PAD,
    paddingBottom: 100,
  },
  greetingSection: {
    marginBottom: 24,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingLeft: {
    flex: 1,
  },
  greetingSmall: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  greetingName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    fontFamily: 'Inter_700Bold',
    marginTop: 1,
  },
  avatarBtn: {
    marginLeft: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.brand.accent,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.brand.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  wardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.brand.sectionBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  wardText: {
    fontSize: 12,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItemOuter: {
    width: TILE_W,
  },
  gridItem: {
    borderRadius: 18,
    padding: 16,
    paddingTop: 18,
    paddingBottom: 14,
    minHeight: TILE_W * 0.82,
    justifyContent: 'space-between',
  },
  gridItemPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  gridIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 18,
  },
  gridBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#EF4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  gridBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    fontFamily: 'Inter_700Bold',
  },
});

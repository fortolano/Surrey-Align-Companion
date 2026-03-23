import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, keepPreviousData, useIsFetching } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import {
  getGlobalRefreshIndicatorUntil,
  subscribeGlobalRefreshIndicator,
} from '@/lib/refresh-indicator';
import { requestLeaveGuard } from '@/lib/navigation-leave-guard';
import Colors from '@/constants/colors';
import { webShadowRgba } from '@/lib/web-styles';
import { UI_TOUCH_MIN } from '@/constants/ui';

function getStandaloneSafeBottom(): number {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') return 0;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isIos = /iphone|ipad|ipod/i.test(nav.userAgent);
  const hasStandaloneDisplayMode =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches;
  const likelyIosStandalone =
    isIos &&
    Math.abs(window.innerHeight - window.screen.height) <= 8;
  const isStandalone =
    hasStandaloneDisplayMode ||
    likelyIosStandalone ||
    nav.standalone === true;
  if (!isStandalone) return 0;

  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  (document.body || document.documentElement).appendChild(probe);
  const envValue = parseFloat(window.getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  if (envValue > 0) return envValue;

  // Fallback for iOS standalone sessions where env() is briefly unresolved.
  return isIos ? 34 : 0;
}

const STANDALONE_SAFE_BOTTOM = getStandaloneSafeBottom();
const ADD_CIRCLE_SIZE = UI_TOUCH_MIN - 8;
const MIN_REFRESH_INDICATOR_MS = 550;

function TabLabel({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return (
    <Text
      style={[
        tabLabelStyles.label,
        { color },
        focused && tabLabelStyles.labelActive,
      ]}
    >
      {label}
    </Text>
  );
}

function TabBarBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={badgeStyles.badge}>
      <Text style={badgeStyles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const activeFetchCount = useIsFetching();
  const [showRefreshIndicator, setShowRefreshIndicator] = useState(false);
  const refreshShownAtRef = useRef<number>(0);
  const hideRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manualRefreshUntilMs, setManualRefreshUntilMs] = useState<number>(0);

  const { data: notifData } = useQuery({
    queryKey: ['notifications-badge'],
    queryFn: async () => {
      const res = await authFetch(token, '/api/notifications');
      return res;
    },
    enabled: !!token,
    placeholderData: keepPreviousData,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const unreadCount = notifData?.notifications?.filter((n: any) => !n.is_read)?.length ?? 0;

  useEffect(() => {
    if (activeFetchCount > 0) {
      if (hideRefreshTimeoutRef.current) {
        clearTimeout(hideRefreshTimeoutRef.current);
        hideRefreshTimeoutRef.current = null;
      }
      if (!showRefreshIndicator) {
        refreshShownAtRef.current = Date.now();
        setShowRefreshIndicator(true);
      }
      return;
    }

    if (!showRefreshIndicator) return;

    const elapsedMs = Date.now() - refreshShownAtRef.current;
    const remainingMs = Math.max(0, MIN_REFRESH_INDICATOR_MS - elapsedMs);

    hideRefreshTimeoutRef.current = setTimeout(() => {
      setShowRefreshIndicator(false);
      hideRefreshTimeoutRef.current = null;
    }, remainingMs);
  }, [activeFetchCount, showRefreshIndicator]);

  useEffect(() => {
    const unsubscribe = subscribeGlobalRefreshIndicator(() => {
      setManualRefreshUntilMs(getGlobalRefreshIndicatorUntil());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (manualRefreshUntilMs <= Date.now()) return;
    const timeoutMs = manualRefreshUntilMs - Date.now();
    const timer = setTimeout(() => {
      setManualRefreshUntilMs(getGlobalRefreshIndicatorUntil());
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [manualRefreshUntilMs]);

  useEffect(() => {
    return () => {
      if (hideRefreshTimeoutRef.current) {
        clearTimeout(hideRefreshTimeoutRef.current);
      }
    };
  }, []);

  const isManualRefreshVisible = manualRefreshUntilMs > Date.now();
  const shouldShowAnyRefreshIndicator = showRefreshIndicator || isManualRefreshVisible;

  const safeBottom = STANDALONE_SAFE_BOTTOM;
  const hasStandaloneInset = safeBottom > 0;
  const baseHeight = Platform.OS === 'web' ? 72 : 64;
  const tabBarHeight = hasStandaloneInset ? baseHeight + safeBottom + 14 : baseHeight + 4;
  const tabBarPaddingBottom = hasStandaloneInset ? 10 + safeBottom : 10;
  const tabBarPaddingTop = 8;
  const iconSize = 28;

  const buildTabLeaveListeners = (routeName: 'index' | 'add' | 'notifications' | 'more') => (
    { navigation }: { navigation: any }
  ) => ({
    tabPress: (event: any) => {
      const intercepted = requestLeaveGuard({
        reason: 'tab',
        targetRouteName: routeName,
        continueNavigation: () => navigation.navigate(routeName),
      });

      if (intercepted) {
        event.preventDefault();
      }
    },
  });

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.brand.primary,
          tabBarInactiveTintColor: Colors.brand.midGray,
          tabBarStyle: {
            backgroundColor: 'rgba(255,255,255,0.98)',
            borderTopColor: 'transparent',
            borderTopWidth: 0,
            height: tabBarHeight,
            paddingTop: tabBarPaddingTop,
            paddingBottom: tabBarPaddingBottom,
            paddingHorizontal: 10,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            elevation: 8,
            ...webShadowRgba('rgba(15, 23, 42, 0.1)', 0, -6, 18),
          },
          tabBarItemStyle: {
            paddingTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          listeners={buildTabLeaveListeners('index')}
          options={{
            title: 'Home',
            tabBarLabel: ({ focused, color }) => (
              <TabLabel label="Home" focused={focused} color={color} />
            ),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={iconSize} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          listeners={buildTabLeaveListeners('add')}
          options={{
            title: 'Add',
            tabBarLabel: ({ focused, color }) => (
              <TabLabel label="Add" focused={focused} color={color} />
            ),
            tabBarIcon: ({ color, focused }) => (
              <View style={[addBtnStyles.circle, focused && addBtnStyles.circleActive]}>
                <Ionicons name="add" size={22} color={focused ? Colors.brand.primary : Colors.brand.midGray} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          listeners={buildTabLeaveListeners('notifications')}
          options={{
            title: 'Notifications',
            tabBarLabel: ({ focused, color }) => (
              <TabLabel label="Notifications" focused={focused} color={color} />
            ),
            tabBarIcon: ({ color, focused }) => (
              <View>
                <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={iconSize} color={color} />
                <TabBarBadge count={unreadCount} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          listeners={buildTabLeaveListeners('more')}
          options={{
            title: 'More',
            tabBarLabel: ({ focused, color }) => (
              <TabLabel label="More" focused={focused} color={color} />
            ),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'} size={iconSize} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="(routes)"
          options={{
            href: null,
            headerShown: false,
          }}
        />
      </Tabs>

      {shouldShowAnyRefreshIndicator && (
        <View
          pointerEvents="none"
          style={[
            styles.refreshIndicator,
            { top: insets.top + 8 },
          ]}
          testID="global-refresh-indicator"
        >
          <ActivityIndicator size="small" color={Colors.brand.primary} />
        </View>
      )}
    </View>
  );
}

const addBtnStyles = StyleSheet.create({
  circle: {
    width: ADD_CIRCLE_SIZE,
    height: ADD_CIRCLE_SIZE,
    borderRadius: ADD_CIRCLE_SIZE / 2,
    backgroundColor: Colors.brand.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.brand.lightGray,
    marginTop: -2,
  },
  circleActive: {
    backgroundColor: Colors.brand.accent,
    borderColor: Colors.brand.primary,
  },
});

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#EF4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: Colors.brand.white,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
});

const tabLabelStyles = StyleSheet.create({
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 3,
  },
  labelActive: {
    fontFamily: 'Inter_700Bold',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.brand.white,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...webShadowRgba('rgba(15, 23, 42, 0.14)', 0, 3, 10),
    elevation: 4,
  },
});

import React from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';

function TabBarBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={badgeStyles.badge}>
      <Text style={badgeStyles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { token, isAuthenticated } = useAuth();

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

  const webBottomInset = Platform.OS === 'web' ? 34 : 0;
  const tabBarHeight = Platform.OS === 'web' ? 60 + webBottomInset : 64;
  const iconSize = 26;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: Colors.brand.midGray,
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
          marginTop: 0,
        },
        tabBarStyle: {
          backgroundColor: Colors.brand.white,
          borderTopColor: Colors.brand.lightGray,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'web' ? webBottomInset + 4 : 8,
          elevation: 8,
          shadowColor: 'rgba(15, 23, 42, 0.08)',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 1,
          shadowRadius: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ color, focused }) => (
            <View style={addBtnStyles.circle}>
              <Ionicons name="add" size={22} color={focused ? Colors.brand.primary : Colors.brand.midGray} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
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
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'} size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="callings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const addBtnStyles = StyleSheet.create({
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brand.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.brand.lightGray,
    marginTop: -4,
  },
});

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.brand.white,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
});

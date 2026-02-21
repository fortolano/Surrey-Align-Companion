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
  const { token } = useAuth();

  const { data: notifData } = useQuery({
    queryKey: ['notifications-badge'],
    queryFn: async () => {
      const res = await authFetch('/api/notifications', token);
      return res;
    },
    enabled: !!token,
    placeholderData: keepPreviousData,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const unreadCount = notifData?.notifications?.filter((n: any) => !n.is_read)?.length ?? 0;

  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: Colors.brand.midGray,
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: Colors.brand.white,
          borderTopColor: Colors.brand.lightGray,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 50 + webBottomInset,
          paddingBottom: webBottomInset > 0 ? webBottomInset : undefined,
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="callings"
        options={{
          title: 'Callings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="notifications-outline" size={size} color={color} />
              <TabBarBadge count={unreadCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.brand.white,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
});

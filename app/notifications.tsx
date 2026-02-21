import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: {
    calling_request_id?: number;
    [key: string]: any;
  };
}

const NOTIF_ICONS: Record<string, { name: string; color: string; bg: string }> = {
  vote_requested: { name: 'hand-left-outline', color: '#B45309', bg: '#FEF3C7' },
  vote_cast: { name: 'checkmark-circle-outline', color: '#065f46', bg: '#d1fae5' },
  status_changed: { name: 'swap-horizontal-outline', color: '#1e40af', bg: '#dbeafe' },
  decision_made: { name: 'shield-checkmark-outline', color: '#065f46', bg: '#d1fae5' },
  calling_approved: { name: 'checkmark-done-outline', color: '#065f46', bg: '#d1fae5' },
  calling_not_approved: { name: 'close-circle-outline', color: '#9d174d', bg: '#fce7f3' },
  comment_added: { name: 'chatbubble-outline', color: '#1e40af', bg: '#dbeafe' },
  feedback_requested: { name: 'help-circle-outline', color: '#B45309', bg: '#FEF3C7' },
  feedback_received: { name: 'chatbubble-ellipses-outline', color: '#065f46', bg: '#d1fae5' },
  step_completed: { name: 'checkbox-outline', color: '#065f46', bg: '#d1fae5' },
  reminder: { name: 'alarm-outline', color: '#B45309', bg: '#FEF3C7' },
  default: { name: 'notifications-outline', color: Colors.brand.primary, bg: '#E8F4F8' },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qClient = useQueryClient();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<{
    notifications: Notification[];
    meta: { total: number; unread_count: number };
  }>({
    queryKey: ['/api/notifications'],
    queryFn: () => authFetch(token, '/api/notifications'),
    enabled: !!token,
    staleTime: 15000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.meta?.unread_count ?? 0;

  const markAsRead = useCallback(async (notifId: number) => {
    try {
      await authFetch(token, `/api/notifications/${notifId}/read`, { method: 'POST' });
      qClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    } catch {}
  }, [token, qClient]);

  const markAllRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      await authFetch(token, '/api/notifications/read-all', { method: 'POST' });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
      qClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    } catch {}
    setMarkingAllRead(false);
  }, [token, refetch, qClient]);

  const handleNotifPress = useCallback((notif: Notification) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!notif.is_read) markAsRead(notif.id);
    const crId = notif.data?.calling_request_id;
    if (crId) {
      router.push({ pathname: '/calling-detail', params: { id: String(crId) } });
    }
  }, [markAsRead]);

  const getIcon = (type: string) => NOTIF_ICONS[type] || NOTIF_ICONS.default;

  const renderNotif = ({ item, index }: { item: Notification; index: number }) => {
    const icon = getIcon(item.type);
    return (
      <Animated.View entering={FadeInDown.duration(250).delay(Math.min(index * 40, 200))}>
        <Pressable
          onPress={() => handleNotifPress(item)}
          style={({ pressed }) => [
            styles.notifRow,
            !item.is_read && styles.notifRowUnread,
            pressed && { opacity: 0.7 },
          ]}
          testID={`notif-${item.id}`}
        >
          <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name as any} size={18} color={icon.color} />
          </View>
          <View style={styles.notifContent}>
            <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]} numberOfLines={2}>
              {item.title || item.message}
            </Text>
            {item.title && item.message && item.message !== item.title && (
              <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
            )}
            <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
          </View>
          {!item.is_read && <View style={styles.unreadDot} />}
          {item.data?.calling_request_id && (
            <Ionicons name="chevron-forward" size={16} color={Colors.brand.midGray} style={{ marginLeft: 4 }} />
          )}
        </Pressable>
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
        <Text style={styles.errorText}>Unable to load notifications</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>{unreadCount} unread</Text>
          <Pressable
            onPress={markAllRead}
            style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
            disabled={markingAllRead}
          >
            {markingAllRead ? (
              <ActivityIndicator size="small" color={Colors.brand.primary} />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </Pressable>
        </View>
      )}
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNotif}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + webBottomInset + 24 },
          notifications.length === 0 && styles.emptyContainer,
        ]}
        scrollEnabled={!!notifications.length}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.brand.primary}
            colors={[Colors.brand.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.brand.midGray} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              You'll see updates here when there's activity on your calling requests.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: Colors.brand.dark,
    marginTop: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: Colors.brand.white,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
    backgroundColor: Colors.brand.white,
  },
  topBarText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E8F4F8',
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
    backgroundColor: Colors.brand.white,
  },
  notifRowUnread: {
    backgroundColor: '#F0F9FF',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  notifTitleUnread: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600' as const,
  },
  notifMessage: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brand.primary,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

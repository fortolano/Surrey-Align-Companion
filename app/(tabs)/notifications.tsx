import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';
import { WEB_TOP_INSET, WEB_BOTTOM_INSET } from '@/constants/layout';
import ScreenHeader from '@/components/ScreenHeader';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: {
    calling_request_id?: number;
    related_type?: string;
    related_id?: number;
    [key: string]: any;
  };
}

type FilterTab = 'all' | 'unread' | 'read';

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

const SWIPE_THRESHOLD = 80;
const DELETE_THRESHOLD = 160;
const SCREEN_WIDTH = Dimensions.get('window').width;

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

function SwipeableNotifRow({
  item,
  index,
  onPress,
  onMarkRead,
  onMarkUnread,
  onDelete,
}: {
  item: Notification;
  index: number;
  onPress: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
}) {
  const translateX = useSharedValue(0);
  const icon = NOTIF_ICONS[item.type] || NOTIF_ICONS.default;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      translateX.value = Math.min(0, e.translationX);
    })
    .onEnd((e) => {
      if (e.translationX < -DELETE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 });
        runOnJS(onDelete)();
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SWIPE_THRESHOLD, { damping: 20 });
      } else {
        translateX.value = withSpring(0, { damping: 20 });
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (translateX.value < -20) {
      translateX.value = withSpring(0, { damping: 20 });
    } else {
      runOnJS(onPress)();
    }
  });

  const composed = Gesture.Race(panGesture, tapGesture);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionsBgStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -20 ? withTiming(1, { duration: 100 }) : withTiming(0, { duration: 100 }),
  }));

  return (
    <Animated.View entering={FadeInDown.duration(250).delay(Math.min(index * 40, 200))}>
      <View style={styles.swipeContainer}>
        <Animated.View style={[styles.swipeActions, actionsBgStyle]}>
          <Pressable
            onPress={() => {
              translateX.value = withSpring(0, { damping: 20 });
              item.is_read ? onMarkUnread() : onMarkRead();
            }}
            style={[styles.swipeActionBtn, { backgroundColor: Colors.brand.primary }]}
          >
            <Ionicons
              name={item.is_read ? 'mail-unread-outline' : 'mail-open-outline'}
              size={20}
              color="#fff"
            />
            <Text style={styles.swipeActionText}>{item.is_read ? 'Unread' : 'Read'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 });
              onDelete();
            }}
            style={[styles.swipeActionBtn, { backgroundColor: '#EF4444' }]}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.swipeActionText}>Delete</Text>
          </Pressable>
        </Animated.View>
        <GestureDetector gesture={composed}>
          <Animated.View
            style={[
              styles.notifRow,
              !item.is_read && styles.notifRowUnread,
              rowStyle,
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
              <Ionicons name={icon.name as any} size={18} color={icon.color} />
            </View>
            <View style={styles.notifContent}>
              <Text
                style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}
                numberOfLines={2}
              >
                {item.title || item.message}
              </Text>
              {item.title && item.message && item.message !== item.title && (
                <Text style={styles.notifMessage} numberOfLines={2}>
                  {item.message}
                </Text>
              )}
              <View style={styles.notifMeta}>
                <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                {item.data?.calling_request_id && (
                  <View style={styles.linkChip}>
                    <Ionicons name="open-outline" size={11} color={Colors.brand.primary} />
                    <Text style={styles.linkChipText}>View</Text>
                  </View>
                )}
              </View>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
            {item.data?.calling_request_id && (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={Colors.brand.midGray}
                style={{ marginLeft: 4 }}
              />
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qClient = useQueryClient();
  const webBottomInset = WEB_BOTTOM_INSET;
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<{
    notifications: Notification[];
    meta: { total: number; unread_count: number };
  }>({
    queryKey: ['/api/notifications'],
    queryFn: () => authFetch(token, '/api/notifications'),
    enabled: !!token,
    staleTime: 30000,
  });

  const allNotifications = data?.notifications || [];
  const unreadCount = data?.meta?.unread_count ?? 0;
  const readCount = allNotifications.length - unreadCount;

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') return allNotifications.filter((n) => !n.is_read);
    if (activeFilter === 'read') return allNotifications.filter((n) => n.is_read);
    return allNotifications;
  }, [allNotifications, activeFilter]);

  const invalidateAll = useCallback(() => {
    qClient.invalidateQueries({ queryKey: ['/api/notifications'] });
  }, [qClient]);

  const markReadMut = useMutation({
    mutationFn: (id: number) => authFetch(token, `/api/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: invalidateAll,
  });

  const markUnreadMut = useMutation({
    mutationFn: (id: number) => authFetch(token, `/api/notifications/${id}/unread`, { method: 'POST' }),
    onSuccess: invalidateAll,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => authFetch(token, `/api/notifications/${id}`, { method: 'DELETE' }),
    onSuccess: invalidateAll,
  });

  const markAllRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      await authFetch(token, '/api/notifications/read-all', { method: 'POST' });
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateAll();
    } catch {}
    setMarkingAllRead(false);
  }, [token, invalidateAll]);

  const handleNotifPress = useCallback(
    (notif: Notification) => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!notif.is_read) markReadMut.mutate(notif.id);
      const crId = notif.data?.calling_request_id;
      const relatedType = notif.data?.related_type;
      if (crId) {
        router.push({ pathname: '/calling-detail', params: { id: String(crId) } });
      } else if (relatedType === 'StakeBusiness') {
        router.push('/sunday-business');
      }
    },
    [markReadMut]
  );

  const confirmDelete = useCallback(
    (notif: Notification) => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const doDelete = () => deleteMut.mutate(notif.id);
      Alert.alert('Delete Notification', 'Are you sure you want to delete this?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    },
    [deleteMut]
  );

  const getFilterLabel = (tab: FilterTab) => {
    if (tab === 'all') return `All (${allNotifications.length})`;
    if (tab === 'unread') return `Unread (${unreadCount})`;
    return `Read (${readCount})`;
  };

  const renderNotif = ({ item, index }: { item: Notification; index: number }) => {
    return (
      <SwipeableNotifRow
        item={item}
        index={index}
        onPress={() => handleNotifPress(item)}
        onMarkRead={() => markReadMut.mutate(item.id)}
        onMarkUnread={() => markUnreadMut.mutate(item.id)}
        onDelete={() => confirmDelete(item)}
      />
    );
  };

  const emptyMessage = useMemo(() => {
    if (activeFilter === 'unread') return 'No unread notifications';
    if (activeFilter === 'read') return 'No read notifications';
    return 'No notifications yet';
  }, [activeFilter]);

  const emptySubtitle = useMemo(() => {
    if (activeFilter === 'unread') return "You're all caught up!";
    if (activeFilter === 'read') return 'Notifications you read will appear here.';
    return "You'll see updates here when there's activity on your calling requests.";
  }, [activeFilter]);

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

  const webTopInset = WEB_TOP_INSET;

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScreenHeader title="Notifications" />
      <View style={styles.filterBar}>
        {(['all', 'unread', 'read'] as FilterTab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              setActiveFilter(tab);
              if (Platform.OS !== 'web') Haptics.selectionAsync();
            }}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            testID={`filter-${tab}`}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === tab && styles.filterTabTextActive,
              ]}
            >
              {getFilterLabel(tab)}
            </Text>
          </Pressable>
        ))}
      </View>

      {unreadCount > 0 && activeFilter !== 'read' && (
        <View style={styles.actionBar}>
          <Text style={styles.actionBarText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
          <Pressable
            onPress={markAllRead}
            style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
            disabled={markingAllRead}
            testID="mark-all-read"
          >
            {markingAllRead ? (
              <ActivityIndicator size="small" color={Colors.brand.primary} />
            ) : (
              <>
                <Ionicons name="checkmark-done-outline" size={16} color={Colors.brand.primary} />
                <Text style={styles.markAllText}>Mark all read</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {Platform.OS !== 'web' && allNotifications.length > 0 && (
        <View style={styles.swipeHint}>
          <Ionicons name="arrow-back" size={12} color={Colors.brand.midGray} />
          <Text style={styles.swipeHintText}>Swipe left for options</Text>
        </View>
      )}

      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNotif}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + webBottomInset + 24 },
          filteredNotifications.length === 0 && styles.emptyContainer,
        ]}
        scrollEnabled={!!filteredNotifications.length}
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
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name={
                  activeFilter === 'unread'
                    ? 'checkmark-circle-outline'
                    : 'notifications-off-outline'
                }
                size={36}
                color={Colors.brand.midGray}
              />
            </View>
            <Text style={styles.emptyTitle}>{emptyMessage}</Text>
            <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
          </View>
        }
      />
    </GestureHandlerRootView>
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
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.brand.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.light.background,
  },
  filterTabActive: {
    backgroundColor: Colors.brand.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.brand.darkGray,
  },
  filterTabTextActive: {
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FDE68A',
  },
  actionBarText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400E',
    fontFamily: 'Inter_600SemiBold',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(1, 97, 131, 0.1)',
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: Colors.light.background,
  },
  swipeHintText: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  listContent: {
    paddingTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  swipeActionBtn: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  swipeActionText: {
    fontSize: 11,
    color: '#fff',
    fontFamily: 'Inter_500Medium',
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
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand.primary,
    paddingLeft: 17,
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
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  notifTime: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E8F4F8',
  },
  linkChipText: {
    fontSize: 11,
    color: Colors.brand.primary,
    fontFamily: 'Inter_500Medium',
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
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 260,
  },
});

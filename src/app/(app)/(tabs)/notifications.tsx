import React, { useState, useCallback, useMemo, useRef } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { appAlert } from '@/lib/platform-alert';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import { withReturnTarget } from '@/lib/navigation-return-target';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import AppButton from '@/components/ui/AppButton';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';
import ScreenHeader from '@/components/ScreenHeader';
import AvatarMenu from '@/components/AvatarMenu';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  action_url?: string | null;
  related_type?: string | null;
  related_id?: number | null;
  is_read: boolean;
  created_at: string;
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
  agenda_assignment: { name: 'calendar-outline', color: '#1E40AF', bg: '#DBEAFE' },
  agenda_published: { name: 'calendar-clear-outline', color: '#065F46', bg: '#D1FAE5' },
  agenda_unassignment: { name: 'calendar-clear-outline', color: '#B45309', bg: '#FEF3C7' },
  agenda_response_declined: { name: 'alert-circle-outline', color: '#991B1B', bg: '#FEE2E2' },
  default: { name: 'notifications-outline', color: Colors.brand.primary, bg: '#E8F4F8' },
};

const SWIPE_ACTION_BUTTON_WIDTH = 88;
const SWIPE_ACTION_TOTAL_WIDTH = SWIPE_ACTION_BUTTON_WIDTH * 2;
const SWIPE_OPEN_THRESHOLD = SWIPE_ACTION_TOTAL_WIDTH / 2;
const EMPTY_NOTIFICATIONS: Notification[] = [];

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
  onPress,
  onMarkRead,
  onMarkUnread,
  onDelete,
}: {
  item: Notification;
  onPress: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
}) {
  const swipeableRef = useRef<any>(null);
  const icon = NOTIF_ICONS[item.type] || NOTIF_ICONS.default;
  const isActionable = Boolean(
    item.action_url ||
    item.related_type ||
    item.type === 'agenda_assignment' ||
    item.type === 'agenda_published' ||
    item.type === 'agenda_unassignment'
  );

  const handleToggleRead = useCallback(() => {
    swipeableRef.current?.close();
    if (item.is_read) {
      onMarkUnread();
      return;
    }
    onMarkRead();
  }, [item.is_read, onMarkRead, onMarkUnread]);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    onDelete();
  }, [onDelete]);

  return (
    <View>
      <Swipeable
        ref={swipeableRef}
        friction={2}
        overshootRight={false}
        rightThreshold={SWIPE_OPEN_THRESHOLD}
        dragOffsetFromRightEdge={10}
        containerStyle={styles.swipeContainer}
        renderRightActions={() => (
          <View style={styles.swipeActions}>
            <Pressable
              onPress={handleToggleRead}
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
              onPress={handleDelete}
              style={[styles.swipeActionBtn, { backgroundColor: '#EF4444' }]}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.swipeActionText}>Delete</Text>
            </Pressable>
          </View>
        )}
      >
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.notifRow,
            !item.is_read && styles.notifRowUnread,
            pressed && { opacity: 0.9 },
          ]}
          testID={`notification-row-${item.id}`}
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
              {isActionable && (
                <View style={styles.linkChip}>
                  <Ionicons name="open-outline" size={11} color={Colors.brand.primary} />
                  <Text style={styles.linkChipText}>Open</Text>
                </View>
              )}
            </View>
          </View>
          {!item.is_read && <View style={styles.unreadDot} />}
          {isActionable && (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.brand.midGray}
              style={{ marginLeft: 4 }}
            />
          )}
        </Pressable>
      </Swipeable>
    </View>
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

  const allNotifications = data?.notifications ?? EMPTY_NOTIFICATIONS;
  const unreadCount = data?.meta?.unread_count ?? 0;
  const readCount = allNotifications.length - unreadCount;
  const filterItems = useMemo(
    () => ([
      { key: 'all', label: `All (${allNotifications.length})` },
      { key: 'unread', label: `Unread (${unreadCount})` },
      { key: 'read', label: `Read (${readCount})` },
    ] as { key: FilterTab; label: string }[]),
    [allNotifications.length, unreadCount, readCount]
  );

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
    onError: (error: any) => {
      appAlert('Unable to update notification', error?.message || 'Please try again.');
    },
  });

  const markUnreadMut = useMutation({
    mutationFn: (id: number) => authFetch(token, `/api/notifications/${id}/unread`, { method: 'POST' }),
    onSuccess: invalidateAll,
    onError: (error: any) => {
      appAlert('Unable to update notification', error?.message || 'Please try again.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => authFetch(token, `/api/notifications/${id}`, { method: 'DELETE' }),
    onSuccess: invalidateAll,
    onError: (error: any) => {
      appAlert('Unable to delete notification', error?.message || 'Please try again.');
    },
  });

  const markAllRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      await authFetch(token, '/api/notifications/read-all', { method: 'POST' });
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      invalidateAll();
    } catch {}
    setMarkingAllRead(false);
  }, [token, invalidateAll]);

  const handleNotifPress = useCallback(
    async (notif: Notification) => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!notif.is_read) markReadMut.mutate(notif.id);

      const relatedType = notif.related_type;
      const relatedId = notif.related_id;
      if (relatedType === 'CallingRequest' && relatedId) {
        router.push(withReturnTarget('/calling-detail', '/notifications', { id: String(relatedId) }));
      } else if (relatedType === 'StakeBusiness') {
        router.push(withReturnTarget('/sunday-business', '/notifications'));
      } else if (
        relatedType === 'agenda' ||
        relatedType === 'agenda_item' ||
        notif.type === 'agenda_assignment' ||
        notif.type === 'agenda_published' ||
        notif.type === 'agenda_unassignment'
      ) {
        router.push(withReturnTarget('/assignments', '/notifications'));
      } else if (notif.action_url) {
        await Linking.openURL(notif.action_url);
      }
    },
    [markReadMut]
  );

  const confirmDelete = useCallback(
    (notif: Notification) => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const doDelete = () => deleteMut.mutate(notif.id);
      appAlert('Delete Notification', 'Are you sure you want to delete this?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    },
    [deleteMut]
  );

  const renderNotif = ({ item }: { item: Notification }) => {
    return (
      <SwipeableNotifRow
        item={item}
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
    return "You'll see updates here when there's new activity to review.";
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
        <AppButton label="Retry" onPress={() => refetch()} size="large" style={styles.retryBtn} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notifications" subtitle="Stay up to date" rightElement={<AvatarMenu />} />
      <View style={styles.filterBar}>
        <AppSegmentedControl
          items={filterItems}
          activeKey={activeFilter}
          onChange={(value) => {
            setActiveFilter(value as FilterTab);
            if (Platform.OS !== 'web') Haptics.selectionAsync();
          }}
          style={styles.filterControl}
          testIDPrefix="filter"
        />
      </View>

      {unreadCount > 0 && activeFilter !== 'read' && (
        <View style={styles.actionBar}>
          <Text style={styles.actionBarText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
          <AppButton
            label="Mark all read"
            onPress={markAllRead}
            loading={markingAllRead}
            variant="secondary"
            style={styles.markAllBtn}
            testID="mark-all-read"
          />
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
            onRefresh={() => {
              triggerGlobalRefreshIndicator();
              refetch();
            }}
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
    minWidth: 148,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterControl: {
    backgroundColor: Colors.brand.white,
    ...webShadowRgba('rgba(15, 23, 42, 0.05)', 0, 2, 6),
    elevation: 1,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 12,
  },
  actionBarText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#92400E',
    fontFamily: 'Inter_600SemiBold',
  },
  markAllBtn: {
    minWidth: 152,
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
    fontSize: 15,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  listContent: {
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  swipeContainer: {
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 2, 8),
    elevation: 1,
  },
  swipeActions: {
    width: SWIPE_ACTION_TOTAL_WIDTH,
    flexDirection: 'row',
    height: '100%',
  },
  swipeActionBtn: {
    width: SWIPE_ACTION_BUTTON_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  swipeActionText: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'Inter_500Medium',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    fontSize: 15,
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
    fontSize: 14,
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
    fontSize: 15,
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

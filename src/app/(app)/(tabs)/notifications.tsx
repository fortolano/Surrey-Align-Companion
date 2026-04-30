import React, { useState, useCallback, useMemo, useRef } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
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
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import {
  resolveNotificationTarget,
  type NotificationAppAction,
} from '@/lib/notification-actions';
import {
  getNotificationPresentation,
  notificationActionLabel,
  notificationSurfaceLabel,
} from '@/lib/notification-presentation';
import { appAlert } from '@/lib/platform-alert';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import AppButton from '@/components/ui/AppButton';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';
import AppStatusBadge from '@/components/ui/AppStatusBadge';
import ScreenHeader from '@/components/ScreenHeader';
import AvatarMenu from '@/components/AvatarMenu';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  app_action?: NotificationAppAction | null;
  action_url?: string | null;
  related_type?: string | null;
  related_id?: number | null;
  is_read: boolean;
  created_at: string;
}

type FilterTab = 'all' | 'unread' | 'read';

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
  isActionable,
}: {
  item: Notification;
  onPress: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
  isActionable: boolean;
}) {
  const swipeableRef = useRef<any>(null);
  const presentation = getNotificationPresentation(item);
  const surfaceLabel = notificationSurfaceLabel(item);
  const actionLabel = notificationActionLabel(item);

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
          <View style={[styles.iconCircle, { backgroundColor: presentation.iconBackground }]}>
            <Ionicons name={presentation.iconName as any} size={20} color={presentation.iconColor} />
          </View>
          <View style={styles.notifContent}>
            <View style={styles.notifHeader}>
              <AppStatusBadge
                label={surfaceLabel}
                backgroundColor={Colors.brand.accentWarm}
                textColor={Colors.brand.midGray}
                style={styles.surfaceBadge}
              />
              <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
            </View>
            <Text
              style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}
              numberOfLines={3}
            >
              {item.title || item.message}
            </Text>
            {item.title && item.message && item.message !== item.title && (
              <Text style={styles.notifMessage} numberOfLines={3}>
                {item.message}
              </Text>
            )}
            <View style={styles.notifMeta}>
              {isActionable && (
                <AppStatusBadge
                  label={actionLabel}
                  backgroundColor="#E8F4F8"
                  textColor={Colors.brand.primary}
                  style={styles.linkChip}
                />
              )}
              {!item.is_read && <Text style={styles.unreadLabel}>Unread</Text>}
            </View>
          </View>
          {!item.is_read && <View style={styles.unreadDot} />}
          {isActionable && (
            <Ionicons
              name="chevron-forward-circle"
              size={22}
              color={Colors.brand.midGray}
              style={styles.chevron}
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
  const pathname = usePathname();
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
    qClient.invalidateQueries({ queryKey: ['/api/notifications', { unread_only: 'true' }] });
    qClient.invalidateQueries({ queryKey: ['notifications-badge'] });
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

      const target = resolveNotificationTarget(notif, '/notifications');
      if (!target) {
        return;
      }

      if (target.kind === 'internal') {
        if (
          target.path === pathname ||
          target.path === '/notifications' ||
          target.path.startsWith('/notifications?') ||
          target.path.startsWith('/notifications#')
        ) {
          refetch();
          return;
        }

        router.push(target.path as any);
        return;
      }

      if (typeof window !== 'undefined') {
        window.location.assign(target.url);
      }
    },
    [markReadMut, pathname, refetch]
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
    const target = resolveNotificationTarget(item, '/notifications');
    const isActionable =
      !!target &&
      !(
        target.kind === 'internal' &&
        (
          target.path === pathname ||
          target.path === '/notifications' ||
          target.path.startsWith('/notifications?') ||
          target.path.startsWith('/notifications#')
        )
      );

    return (
      <SwipeableNotifRow
        item={item}
        isActionable={isActionable}
        onPress={() => handleNotifPress(item)}
        onMarkRead={() => markReadMut.mutate(item.id)}
        onMarkUnread={() => markUnreadMut.mutate(item.id)}
        onDelete={() => confirmDelete(item)}
      />
    );
  };

  const emptyMessage = useMemo(() => {
    if (activeFilter === 'unread') return 'No unread updates';
    if (activeFilter === 'read') return 'No read updates';
    return 'No notifications yet';
  }, [activeFilter]);

  const emptySubtitle = useMemo(() => {
    if (activeFilter === 'unread') return "You're caught up for now.";
    if (activeFilter === 'read') return 'Updates you already opened will stay here until you delete them.';
    return 'Important updates from goals, meetings, tasks, and councils will appear here.';
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
      <ScreenHeader title="Notifications" subtitle="Your action inbox" rightElement={<AvatarMenu />} />
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
            {unreadCount} update{unreadCount !== 1 ? 's' : ''} {unreadCount === 1 ? 'still needs' : 'still need'} your attention
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
          <Text style={styles.swipeHintText}>Swipe left to mark read or delete</Text>
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
    paddingBottom: 10,
  },
  filterControl: {
    backgroundColor: Colors.brand.white,
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 4, 12),
    elevation: 1,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 12,
  },
  actionBarText: {
    flex: 1,
    fontSize: 16,
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
    fontSize: 14,
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
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 22,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 6, 16),
    elevation: 2,
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
    fontSize: 15,
    color: '#fff',
    fontFamily: 'Inter_500Medium',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: Colors.brand.white,
    minHeight: 118,
  },
  notifRowUnread: {
    backgroundColor: '#F7FCFE',
    borderLeftWidth: 4,
    borderLeftColor: Colors.brand.primary,
    paddingLeft: 18,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  surfaceBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  notifTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
    lineHeight: 25,
  },
  notifTitleUnread: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600' as const,
  },
  notifMessage: {
    fontSize: 16,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 6,
    lineHeight: 23,
  },
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
    flexWrap: 'wrap',
  },
  notifTime: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  linkChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  unreadLabel: {
    fontSize: 14,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  unreadDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.brand.primary,
    marginLeft: 10,
    marginTop: 10,
  },
  chevron: {
    marginLeft: 8,
    marginTop: 10,
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
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 280,
  },
});

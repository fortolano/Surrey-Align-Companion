import React, { useCallback, useMemo } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Switch,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';

// ─── Types ──────────────────────────────────────

interface CategoryOption {
  key: string;
  label: string;
  description: string;
}

interface FrequencyOption {
  key: string;
  label: string;
}

interface SettingsResponse {
  success: boolean;
  notifications_enabled: boolean;
  preferences: {
    muted_notification_categories: string[];
    email_notification_frequency: string;
  };
  options: {
    categories: CategoryOption[];
    email_frequencies: FrequencyOption[];
  };
}

// ─── Category icons ─────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  decisions: 'checkmark-circle-outline',
  feedback: 'chatbubble-ellipses-outline',
  execution: 'clipboard-outline',
  updates: 'newspaper-outline',
};
const EMPTY_MUTED_CATEGORIES: string[] = [];

// ─── Main Screen ────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<SettingsResponse>({
    queryKey: ['user-settings'],
    queryFn: () => authFetch(token, '/api/user/settings'),
    enabled: !!token,
    staleTime: 60000,
  });

  const mutation = useMutation({
    mutationFn: (body: { muted_notification_categories?: string[]; email_notification_frequency?: string }) =>
      authFetch(token, '/api/user/settings', { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
  });

  const prefs = data?.preferences;
  const options = data?.options;
  const notificationsEnabled = data?.notifications_enabled ?? false;
  const mutedCategories = useMemo(
    () => prefs?.muted_notification_categories ?? EMPTY_MUTED_CATEGORIES,
    [prefs?.muted_notification_categories]
  );
  const emailFrequency = prefs?.email_notification_frequency ?? 'daily';
  const frequencyItems = useMemo(
    () => (options?.email_frequencies ?? [])
      .filter((freq) => freq.key !== 'none')
      .map((freq) => ({ key: freq.key, label: freq.label })),
    [options?.email_frequencies]
  );

  const handleToggleCategory = useCallback((categoryKey: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isMuted = mutedCategories.includes(categoryKey);
    const updated = isMuted
      ? mutedCategories.filter((c) => c !== categoryKey)
      : [...mutedCategories, categoryKey];
    mutation.mutate({ muted_notification_categories: updated });
  }, [mutedCategories, mutation]);

  const handleChangeFrequency = useCallback((freq: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    mutation.mutate({ email_notification_frequency: freq });
  }, [mutation]);

  const handleRefresh = useCallback(() => {
    triggerGlobalRefreshIndicator();
    refetch();
  }, [refetch]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + WEB_BOTTOM_INSET + 32,
          paddingHorizontal: 20,
          paddingTop: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={Colors.brand.primary} />
        }
      >
        {/* ═══ Account ═══ */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="person-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Signed in as</Text>
            </View>
            <Text style={styles.rowValue} numberOfLines={1}>{user?.email || '—'}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="business-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Stake</Text>
            </View>
            <Text style={styles.rowValue}>{user?.stake || '—'}</Text>
          </View>
        </View>

        {/* ═══ Notification Categories ═══ */}
        <Text style={styles.sectionLabel}>What notifications do you want to receive?</Text>
        <Text style={styles.sectionExplainer}>
          Use these switches to control which types of notifications you see in the app and receive by email. When a category is turned off, you will not be notified about it anywhere.
        </Text>
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={Colors.brand.primary} />
            <Text style={styles.loadingText}>Loading your preferences...</Text>
          </View>
        ) : isError ? (
          <Pressable onPress={() => refetch()} style={styles.loadingCard}>
            <Ionicons name="cloud-offline-outline" size={24} color={Colors.brand.error} />
            <Text style={[styles.loadingText, { color: Colors.brand.error }]}>Unable to load preferences. Tap to retry.</Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.card}>
              {(options?.categories ?? []).map((cat, idx, arr) => {
                const isActive = !mutedCategories.includes(cat.key);
                const iconName = CATEGORY_ICONS[cat.key] || 'ellipse-outline';
                return (
                  <React.Fragment key={cat.key}>
                    <View style={styles.row}>
                      <View style={styles.rowLeft}>
                        <Ionicons name={iconName as any} size={20} color={isActive ? Colors.brand.primary : Colors.brand.midGray} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowLabel}>{cat.label}</Text>
                          <Text style={styles.rowDesc}>{cat.description}</Text>
                        </View>
                      </View>
                      <Switch
                        value={isActive}
                        onValueChange={() => handleToggleCategory(cat.key)}
                        trackColor={{ false: Colors.brand.lightGray, true: Colors.brand.primary + '60' }}
                        thumbColor={isActive ? Colors.brand.primary : '#f4f3f4'}
                        ios_backgroundColor={Colors.brand.lightGray}
                      />
                    </View>
                    {idx < arr.length - 1 && <View style={styles.rowDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
            <Text style={styles.hintText}>
              Turning a category off hides those notifications from this app and stops related emails. Your changes are saved automatically.
            </Text>
          </>
        )}

        {/* ═══ Email Notifications ═══ */}
        <Text style={styles.sectionLabel}>How often should we email you?</Text>
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={Colors.brand.primary} />
          </View>
        ) : !notificationsEnabled ? (
          <View style={styles.card}>
            <View style={[styles.row, { paddingVertical: 18 }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="mail-outline" size={20} color={Colors.brand.midGray} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: Colors.brand.midGray }]}>
                    Email notifications are not enabled yet.
                  </Text>
                  <Text style={styles.rowDesc}>Your stake administrator will enable this feature when it is ready.</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.sectionExplainer}>
              Instead of sending you a separate email for every notification, we bundle them into a single summary email. Choose how often you would like to receive it.
            </Text>
            <View style={styles.card}>
              <View style={[styles.row, { paddingVertical: 10 }]}>
                <View style={styles.rowLeft}>
                  <Ionicons name="mail-outline" size={20} color={Colors.brand.primary} />
                  <Text style={styles.rowLabel}>Email Summary Frequency</Text>
                </View>
              </View>
              {frequencyItems.length > 0 ? (
                <AppSegmentedControl
                  items={frequencyItems}
                  activeKey={emailFrequency}
                  onChange={handleChangeFrequency}
                  style={styles.freqRow}
                  testIDPrefix="settings-email-frequency"
                />
              ) : null}

              {/* Stop all emails */}
              <View style={[styles.row, { paddingTop: 4 }]}>
                <View style={styles.rowLeft}>
                  <Ionicons name="notifications-off-outline" size={20} color={emailFrequency === 'none' ? Colors.brand.error : Colors.brand.midGray} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, emailFrequency === 'none' && { color: Colors.brand.error }]}>Stop all emails</Text>
                    <Text style={styles.rowDesc}>I will check the app or website directly.</Text>
                  </View>
                </View>
                <Switch
                  value={emailFrequency === 'none'}
                  onValueChange={(val) => handleChangeFrequency(val ? 'none' : 'daily')}
                  trackColor={{ false: Colors.brand.lightGray, true: Colors.brand.error + '60' }}
                  thumbColor={emailFrequency === 'none' ? Colors.brand.error : '#f4f3f4'}
                  ios_backgroundColor={Colors.brand.lightGray}
                />
              </View>
            </View>
            <Text style={styles.hintText}>
              {'We bundle your notifications into one summary email. Only categories you have turned on above will be included. Turn on "Stop all emails" if you prefer to check the app or website on your own.'}
            </Text>
          </>
        )}

        {/* ═══ Data ═══ */}
        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="cloud-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Data Source</Text>
            </View>
            <Text style={styles.rowValue}>SurreyAlign.org</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Session</Text>
            </View>
            <Text style={[styles.rowValue, { color: Colors.brand.success }]}>Active</Text>
          </View>
        </View>

        {/* ═══ Appearance (placeholder) ═══ */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="moon-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Dark Mode</Text>
            </View>
            <Text style={[styles.rowValue, { color: Colors.brand.midGray, fontStyle: 'italic' }]}>Coming soon</Text>
          </View>
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
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.brand.midGray,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionExplainer: {
    fontSize: 15,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    ...webShadowRgba('rgba(1, 97, 131, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  rowDesc: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.brand.darkGray,
    textAlign: 'right' as const,
    fontFamily: 'Inter_500Medium',
    flexShrink: 1,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.brand.lightGray,
    marginLeft: 48,
  },
  hintText: {
    fontSize: 14,
    color: Colors.brand.midGray,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    paddingVertical: 24,
    marginBottom: 8,
    ...webShadowRgba('rgba(1, 97, 131, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  freqRow: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
});

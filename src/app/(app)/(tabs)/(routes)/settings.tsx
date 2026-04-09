import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import AppButton from '@/components/ui/AppButton';
import AppStatusBadge from '@/components/ui/AppStatusBadge';
import {
  disablePushForCurrentDevice,
  enablePushForCurrentDevice,
  getPushDeviceState,
  type PushDeviceState,
} from '@/lib/push-notifications';
import { mapCatalogIconToIonicon } from '@/lib/notification-presentation';

// ─── Types ──────────────────────────────────────

interface CategoryOption {
  key: string;
  label: string;
  description: string;
  icon?: string;
}

interface FrequencyOption {
  key: string;
  label: string;
  description?: string;
}

interface SettingsResponse {
  success: boolean;
  notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  preferences: {
    muted_notification_categories: string[];
    email_notification_frequency: string;
    push_notification_enabled: boolean;
  };
  options: {
    categories: CategoryOption[];
    email_frequencies: FrequencyOption[];
  };
}

// ─── Category icons ─────────────────────────────

const EMPTY_MUTED_CATEGORIES: string[] = [];
const SWITCH_SCALE = Platform.OS === 'web' ? 1.18 : 1.12;

// ─── Main Screen ────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [pushState, setPushState] = useState<PushDeviceState | null>(null);
  const [isPushBusy, setIsPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<SettingsResponse>({
    queryKey: ['user-settings'],
    queryFn: () => authFetch(token, '/api/user/settings'),
    enabled: !!token,
    staleTime: 60000,
  });

  const mutation = useMutation({
    mutationFn: (body: { muted_notification_categories?: string[]; email_notification_frequency?: string; push_notification_enabled?: boolean }) =>
      authFetch(token, '/api/user/settings', { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
  });

  const prefs = data?.preferences;
  const options = data?.options;
  const notificationsEnabled = data?.notifications_enabled ?? false;
  const pushNotificationsEnabled = data?.push_notifications_enabled ?? false;
  const mutedCategories = useMemo(
    () => prefs?.muted_notification_categories ?? EMPTY_MUTED_CATEGORIES,
    [prefs?.muted_notification_categories]
  );
  const emailFrequency = prefs?.email_notification_frequency ?? 'daily';
  const pushPreferenceEnabled = prefs?.push_notification_enabled ?? true;
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

  const handleTogglePushPreference = useCallback((enabled: boolean) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    mutation.mutate({ push_notification_enabled: enabled });
  }, [mutation]);

  const refreshPushState = useCallback(async () => {
    if (!token) {
      setPushState(null);
      return;
    }

    try {
      setPushError(null);
      setPushState(await getPushDeviceState(token));
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Unable to check mobile alert status right now.');
    }
  }, [token]);

  useEffect(() => {
    void refreshPushState();
  }, [refreshPushState]);

  useEffect(() => {
    void refreshPushState();
  }, [pushPreferenceEnabled, refreshPushState]);

  const handleEnablePush = useCallback(async () => {
    if (!token) return;
    if (Platform.OS !== 'web') return;

    setIsPushBusy(true);
    setPushError(null);

    try {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPushState(await enablePushForCurrentDevice(token));
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Unable to turn on mobile alerts right now.');
      await refreshPushState();
    } finally {
      setIsPushBusy(false);
    }
  }, [refreshPushState, token]);

  const handleDisablePush = useCallback(async () => {
    if (!token) return;

    setIsPushBusy(true);
    setPushError(null);

    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nextState = await disablePushForCurrentDevice(token);
      if (nextState) {
        setPushState(nextState);
      } else {
        await refreshPushState();
      }
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Unable to turn off mobile alerts right now.');
      await refreshPushState();
    } finally {
      setIsPushBusy(false);
    }
  }, [refreshPushState, token]);

  const handleRefresh = useCallback(() => {
    triggerGlobalRefreshIndicator();
    refetch();
    void refreshPushState();
  }, [refetch, refreshPushState]);

  const deviceSetupNeedsConnection = pushState?.permission === 'granted' && !pushState?.hasSubscription;
  const pushActionLabel = pushState?.enabled
    ? 'Refresh this device'
    : (deviceSetupNeedsConnection ? 'Finish connecting this device' : 'Enable mobile alerts');

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
          Turn categories on for the work you want to hear about. Turning one off removes it from this app and from email summaries.
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
                const iconName = mapCatalogIconToIonicon(cat.icon, cat.key);
                return (
                  <React.Fragment key={cat.key}>
                    <View style={styles.row}>
                      <View style={styles.rowLeft}>
                        <View style={[styles.rowIconBadge, isActive && styles.rowIconBadgeActive]}>
                          <Ionicons name={iconName as any} size={18} color={isActive ? Colors.brand.primary : Colors.brand.midGray} />
                        </View>
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
                        style={styles.switchControl}
                      />
                    </View>
                    {idx < arr.length - 1 && <View style={styles.rowDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
            <Text style={styles.hintText}>
              Changes save right away and affect both your app inbox and your email summaries.
            </Text>
          </>
        )}

        {/* ═══ Mobile Alerts ═══ */}
        <Text style={styles.sectionLabel}>Phone alerts for your account</Text>
        <Text style={styles.sectionExplainer}>
          This decides whether SurreyALIGN may send urgent companion-app alerts to any device signed in with your account.
        </Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name={pushPreferenceEnabled ? 'notifications-circle-outline' : 'notifications-off-outline'}
                size={20}
                color={pushPreferenceEnabled && pushNotificationsEnabled ? Colors.brand.primary : Colors.brand.midGray}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Phone alerts for this account</Text>
                <Text style={styles.rowDesc}>
                  {pushNotificationsEnabled
                    ? 'Leave this on if you want timely companion-app alerts on the devices you connect.'
                    : 'Your stake has not turned companion-app alerts on yet.'}
                </Text>
              </View>
            </View>
            <Switch
              value={pushPreferenceEnabled}
              onValueChange={handleTogglePushPreference}
              disabled={!pushNotificationsEnabled || mutation.isPending}
              trackColor={{ false: Colors.brand.lightGray, true: Colors.brand.primary + '60' }}
              thumbColor={pushPreferenceEnabled ? Colors.brand.primary : '#f4f3f4'}
              ios_backgroundColor={Colors.brand.lightGray}
              style={styles.switchControl}
            />
          </View>
        </View>
        <Text style={styles.hintText}>
          This only controls companion-app alerts. Your in-app list still stays available here.
        </Text>

        <Text style={styles.sectionLabel}>Mobile alerts on this device</Text>
        <Text style={styles.sectionExplainer}>
          Use this card to connect the device in your hand. SurreyALIGN only uses these alerts for updates that need quick attention.
        </Text>
        {!pushState ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={Colors.brand.primary} />
            <Text style={styles.loadingText}>Checking this device...</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              {deviceSetupNeedsConnection ? (
                <>
                  <View style={styles.setupCallout}>
                    <Ionicons name="sparkles-outline" size={18} color={Colors.brand.primary} />
                    <View style={styles.setupCalloutBody}>
                      <Text style={styles.setupCalloutTitle}>One more step</Text>
                      <Text style={styles.setupCalloutText}>
                        Notifications are already allowed on this phone. SurreyALIGN still needs to connect this installed app to your account.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowDivider} />
                </>
              ) : null}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons
                    name={pushState.enabled ? 'phone-portrait-outline' : 'notifications-outline'}
                    size={20}
                    color={pushState.enabled ? Colors.brand.primary : Colors.brand.midGray}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>This device</Text>
                    <Text style={styles.rowDesc}>{pushState.message}</Text>
                  </View>
                </View>
                <AppStatusBadge
                  label={pushState.statusLabel}
                  backgroundColor={
                    pushState.enabled
                      ? '#ecfdf3'
                      : pushState.statusLabel === 'Almost on' || pushState.statusLabel === 'Install required'
                        ? '#fff7ed'
                        : pushState.statusLabel === 'Blocked'
                          ? '#fef2f2'
                          : '#f1f5f9'
                  }
                  textColor={
                    pushState.enabled
                      ? Colors.brand.success
                      : pushState.statusLabel === 'Almost on' || pushState.statusLabel === 'Install required'
                        ? '#b45309'
                        : pushState.statusLabel === 'Blocked'
                          ? Colors.brand.error
                          : Colors.brand.midGray
                  }
                  style={styles.statusBadge}
                />
              </View>
              {(pushState.backendEnabled || pushState.enabled) && <View style={styles.rowDivider} />}
              {(pushState.backendEnabled || pushState.enabled) ? (
                <View style={styles.buttonStack}>
                  {!pushState.enabled ? (
                    <AppButton
                      label={pushActionLabel}
                      onPress={handleEnablePush}
                      loading={isPushBusy}
                      disabled={pushState.requiresInstall || pushState.permission === 'denied' || !pushPreferenceEnabled}
                    />
                  ) : (
                    <>
                      <AppButton
                        label="Refresh this device"
                        onPress={handleEnablePush}
                        variant="secondary"
                        loading={isPushBusy}
                      />
                      <AppButton
                        label="Turn off on this device"
                        onPress={handleDisablePush}
                        variant="danger"
                        loading={isPushBusy}
                      />
                    </>
                  )}
                </View>
              ) : null}
            </View>
            {pushError ? (
              <Text style={[styles.hintText, { color: Colors.brand.error }]}>
                {pushError}
              </Text>
            ) : null}
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
              Choose how often SurreyALIGN should send one summary email with the categories you have left on.
            </Text>
            <View style={styles.card}>
              <View style={[styles.row, { paddingVertical: 10 }]}>
                <View style={styles.rowLeft}>
                  <Ionicons name="mail-outline" size={20} color={Colors.brand.primary} />
                  <Text style={styles.rowLabel}>Email Summary Frequency</Text>
                </View>
              </View>
              {frequencyItems.length > 0 ? (
                <View style={styles.frequencyChoiceList}>
                  {frequencyItems.map((freq) => {
                    const isActive = emailFrequency === freq.key;
                    const description = options?.email_frequencies?.find((option) => option.key === freq.key)?.description ?? '';

                    return (
                      <Pressable
                        key={freq.key}
                        onPress={() => handleChangeFrequency(freq.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isActive }}
                        style={({ pressed }) => [
                          styles.frequencyChoiceRow,
                          isActive && styles.frequencyChoiceRowActive,
                          pressed && !isActive && styles.frequencyChoiceRowPressed,
                        ]}
                        testID={`settings-email-frequency-${freq.key}`}
                      >
                        <View style={styles.frequencyChoiceCopy}>
                          <Text style={[styles.frequencyChoiceTitle, isActive && styles.frequencyChoiceTitleActive]}>
                            {freq.label}
                          </Text>
                          {description ? (
                            <Text style={styles.frequencyChoiceDesc}>
                              {description}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[styles.frequencyChoiceIndicator, isActive && styles.frequencyChoiceIndicatorActive]}>
                          <Ionicons
                            name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={isActive ? Colors.brand.primary : Colors.brand.midGray}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
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
                  style={styles.switchControl}
                />
              </View>
            </View>
            <Text style={styles.hintText}>
              Only the categories you leave on above will be included in those summaries.
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
    minHeight: 60,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  rowIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.sectionBg,
    marginTop: 2,
  },
  rowIconBadgeActive: {
    backgroundColor: '#E8F4F8',
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
    marginTop: 3,
    lineHeight: 18,
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
  frequencyChoiceList: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  frequencyChoiceRow: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    backgroundColor: Colors.brand.offWhite,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  frequencyChoiceRowActive: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#eef8fc',
  },
  frequencyChoiceRowPressed: {
    backgroundColor: '#f5fafc',
  },
  frequencyChoiceCopy: {
    flex: 1,
  },
  frequencyChoiceTitle: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  frequencyChoiceTitleActive: {
    color: Colors.brand.primary,
  },
  frequencyChoiceDesc: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginTop: 3,
  },
  frequencyChoiceIndicator: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyChoiceIndicatorActive: {
    transform: [{ scale: 1.02 }],
  },
  buttonStack: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  switchControl: {
    transform: [{ scaleX: SWITCH_SCALE }, { scaleY: SWITCH_SCALE }],
    marginRight: 2,
  },
  setupCallout: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#eef8fc',
  },
  setupCalloutBody: {
    flex: 1,
  },
  setupCalloutTitle: {
    fontSize: 14,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  setupCalloutText: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  statusBadge: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});

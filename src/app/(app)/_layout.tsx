import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';
import { queryClient } from '@/lib/query-client';

const CRITICAL_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function canSeeSpeakingBadge(user: any): boolean {
  if (!user) return false;
  return (
    user.is_stake_presidency_member === true ||
    user.is_high_councilor === true ||
    user.is_stake_council_member === true ||
    user.is_stake_org_presidency_member === true ||
    user.is_stake_director === true
  );
}

export default function AppLayout() {
  const { user, token, isAuthenticated, isLoading } = useAuth();
  const lastCriticalRefreshAtRef = useRef(0);

  const refreshCriticalStartupData = useCallback(async () => {
    if (!token || !user) return;

    const tasks: Promise<void>[] = [
      authFetch(token, '/api/calling-requests/action-required')
        .then((data) => {
          queryClient.setQueryData(['/api/calling-requests/action-required'], data);
        })
        .catch(() => {}),
      authFetch(token, '/api/sunday-business/sunday')
        .then((data) => {
          queryClient.setQueryData(['/api/sunday-business/sunday'], data);
        })
        .catch(() => {}),
      authFetch(token, '/api/notifications', { params: { unread_only: 'true' } })
        .then((data) => {
          queryClient.setQueryData(['/api/notifications', { unread_only: 'true' }], data);
        })
        .catch(() => {}),
      authFetch(token, '/api/notifications')
        .then((data) => {
          queryClient.setQueryData(['/api/notifications'], data);
          queryClient.setQueryData(['notifications-badge'], data);
        })
        .catch(() => {}),
    ];

    if (canSeeSpeakingBadge(user)) {
      tasks.push(
        authFetch(token, '/api/speaking-assignments/pending-action-count')
          .then((data) => {
            queryClient.setQueryData(['speaking-badge'], data);
          })
          .catch(() => {})
      );
    }

    await Promise.all(tasks);
  }, [token, user]);

  useEffect(() => {
    if (!isAuthenticated || !token || !user) return;
    lastCriticalRefreshAtRef.current = Date.now();
    void refreshCriticalStartupData();
  }, [isAuthenticated, token, user, refreshCriticalStartupData]);

  useEffect(() => {
    if (!isAuthenticated || !token || !user) return;

    let appState = AppState.currentState;
    const stateSub = AppState.addEventListener('change', (nextState) => {
      const wasInBackground = appState === 'inactive' || appState === 'background';
      if (wasInBackground && nextState === 'active') {
        const now = Date.now();
        if (now - lastCriticalRefreshAtRef.current >= CRITICAL_REFRESH_INTERVAL_MS) {
          lastCriticalRefreshAtRef.current = now;
          void refreshCriticalStartupData();
        }
      }
      appState = nextState;
    });

    let removeVisibilityListener: (() => void) | null = null;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.visibilityState !== 'visible') return;
        const now = Date.now();
        if (now - lastCriticalRefreshAtRef.current >= CRITICAL_REFRESH_INTERVAL_MS) {
          lastCriticalRefreshAtRef.current = now;
          void refreshCriticalStartupData();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      removeVisibilityListener = () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }

    return () => {
      stateSub.remove();
      removeVisibilityListener?.();
    };
  }, [isAuthenticated, token, user, refreshCriticalStartupData]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.white} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.primary,
  },
});

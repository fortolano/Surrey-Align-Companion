import { getApiUrl } from '@/lib/query-client';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

async function clearStoredAuth() {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem('sa_token');
    await AsyncStorage.removeItem('sa_user');
  } else {
    await SecureStore.deleteItemAsync('sa_token');
    await SecureStore.deleteItemAsync('sa_user');
  }
}

// Global callback for auth expiry — set by AuthProvider
let onAuthExpired: (() => void) | null = null;
export function setAuthExpiredHandler(handler: () => void) {
  onAuthExpired = handler;
}

export async function authFetch(
  token: string | null,
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {}
) {
  if (!token) throw new Error('Not authenticated');
  const base = getApiUrl();
  const url = new URL(path, base);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Handle expired/invalid tokens
  if (res.status === 401) {
    await clearStoredAuth();
    if (onAuthExpired) onAuthExpired();
    throw new Error('Session expired. Please sign in again.');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SA_API_BASE = "https://surreyalign.org/api/external/v1";

export interface SAUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  calling: string;
  ward: string;
  ward_id: number;
  stake: string;
  stake_id: number;
  is_stake_admin: boolean;
  is_stake_presidency: boolean;
  is_active: boolean;
}

interface AuthContextValue {
  user: SAUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SAUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    validateSession();
  }, []);

  async function validateSession() {
    try {
      const storedToken = await secureGet('sa_token');
      const storedUser = await secureGet('sa_user');

      if (!storedToken || !storedUser) {
        setIsLoading(false);
        return;
      }

      const res = await fetch(`${SA_API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${storedToken}`,
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const userData = data.user || data;
        setUser(userData);
        setToken(storedToken);
        await secureSet('sa_user', JSON.stringify(userData));
      } else {
        await secureDelete('sa_token');
        await secureDelete('sa_user');
      }
    } catch {
      const storedUser = await secureGet('sa_user');
      const storedToken = await secureGet('sa_token');
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${SA_API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await secureSet('sa_token', data.token);
        await secureSet('sa_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }

      if (res.status === 422 && data.errors) {
        const firstError = Object.values(data.errors).flat()[0] as string;
        return { success: false, message: firstError || 'Please check your input.' };
      }

      return { success: false, message: data.message || 'Login failed. Please try again.' };
    } catch {
      return { success: false, message: 'Unable to connect. Please check your internet connection.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${SA_API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
      }
    } catch {}
    await secureDelete('sa_token');
    await secureDelete('sa_user');
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
  }), [user, token, isLoading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

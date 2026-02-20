import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, Platform, Dimensions } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const TOAST_CONFIG: Record<ToastType, { icon: string; bg: string; border: string; text: string }> = {
  success: { icon: 'checkmark-circle', bg: '#f0fdf4', border: '#86efac', text: '#065f46' },
  error: { icon: 'alert-circle', bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  info: { icon: 'information-circle', bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  warning: { icon: 'warning', bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const config = TOAST_CONFIG[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <Animated.View
      entering={SlideInUp.duration(300).springify().damping(15)}
      exiting={FadeOutUp.duration(200)}
    >
      <Pressable
        onPress={() => onDismiss(toast.id)}
        style={[styles.toast, { backgroundColor: config.bg, borderColor: config.border }]}
      >
        <Ionicons name={config.icon as any} size={20} color={config.text} />
        <View style={styles.toastContent}>
          <Text style={[styles.toastTitle, { color: config.text }]}>{toast.title}</Text>
          {toast.message && <Text style={[styles.toastMessage, { color: config.text }]}>{toast.message}</Text>}
        </View>
        <Ionicons name="close" size={16} color={config.text} style={{ opacity: 0.5 }} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);
  const webTopInset = Platform.OS === 'web' ? 24 : 0;

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev.slice(-2), { id, type, title, message, duration }]);
  }, []);

  const success = useCallback((title: string, message?: string) => showToast('success', title, message), [showToast]);
  const error = useCallback((title: string, message?: string) => showToast('error', title, message, 4000), [showToast]);
  const info = useCallback((title: string, message?: string) => showToast('info', title, message), [showToast]);
  const warning = useCallback((title: string, message?: string) => showToast('warning', title, message, 4000), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <View style={[styles.container, { top: insets.top + webTopInset + 8 }]} pointerEvents="box-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 460,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(0,0,0,0.1)' } as any
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 }),
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  toastMessage: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
    opacity: 0.8,
  },
});

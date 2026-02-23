import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const webBottomInset = Platform.OS === 'web' ? 34 : 0;


  const infoRows = [
    { label: 'Calling', value: user?.calling || '—', icon: 'briefcase-outline' as const },
    { label: 'Ward', value: user?.ward || '—', icon: 'location-outline' as const },
    { label: 'Stake', value: user?.stake || '—', icon: 'business-outline' as const },
    { label: 'Email', value: user?.email || '—', icon: 'mail-outline' as const },
    { label: 'Phone', value: user?.phone || 'Not set', icon: 'call-outline' as const },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBottomInset + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileHeader, { paddingTop: 24 }]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.fullName}>{user?.name || 'User'}</Text>
          {user?.is_stake_admin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color={Colors.brand.primary} />
              <Text style={styles.adminBadgeText}>Stake Admin</Text>
            </View>
          )}
          {user?.is_stake_presidency_member && !user?.is_stake_admin && (
            <View style={styles.adminBadge}>
              <Ionicons name="star" size={14} color={Colors.brand.primary} />
              <Text style={styles.adminBadgeText}>Stake Presidency</Text>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionLabel}>Profile Information</Text>
          <View style={styles.infoCard}>
            {infoRows.map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.infoRow,
                  i < infoRows.length - 1 && styles.infoRowBorder,
                ]}
              >
                <View style={styles.infoRowLeft}>
                  <Ionicons name={row.icon} size={18} color={Colors.brand.midGray} />
                  <Text style={styles.infoLabel}>{row.label}</Text>
                </View>
                <Text style={styles.infoValue} numberOfLines={1}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actionsSection}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              logout();
            }}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed,
            ]}
            testID="logout-button"
          >
            <Feather name="log-out" size={18} color={Colors.brand.error} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
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
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  fullName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  infoSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.midGray,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  infoCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.brand.black,
    maxWidth: '50%',
    textAlign: 'right' as const,
    fontFamily: 'Inter_500Medium',
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  logoutButtonPressed: {
    backgroundColor: Colors.brand.errorLight,
    transform: [{ scale: 0.98 }],
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.brand.error,
    fontFamily: 'Inter_600SemiBold',
  },
});

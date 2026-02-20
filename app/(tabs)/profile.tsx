import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import Colors from '@/constants/colors';
import { contentContainer, cardShadow } from '@/constants/styles';

interface NavItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'align', label: 'ALIGN', icon: 'compass-outline', route: '/align-info' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings' },
  { id: 'about', label: 'About this App', icon: 'information-circle-outline', route: '/about-app' },
  { id: 'tos', label: 'Terms of Service', icon: 'document-text-outline', route: '/terms' },
];

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/');
    } catch {
      toast.error('Sign Out Failed', 'Please try again.');
    }
  };

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
        contentContainerStyle={styles.scrollContent}
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
          {user?.is_stake_presidency && !user?.is_stake_admin && (
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

        <View style={styles.navSection}>
          <Text style={styles.sectionLabel}>More</Text>
          <View style={styles.infoCard}>
            {NAV_ITEMS.map((item, i) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(item.route as any);
                }}
                style={({ pressed }) => [
                  styles.navRow,
                  i < NAV_ITEMS.length - 1 && styles.infoRowBorder,
                  pressed && styles.navRowPressed,
                ]}
              >
                <View style={styles.infoRowLeft}>
                  <Ionicons name={item.icon} size={18} color={Colors.brand.midGray} />
                  <Text style={styles.navLabel}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.brand.midGray} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.actionsSection}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleLogout();
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
  scrollContent: {
    paddingBottom: 100,
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
  navSection: {
    paddingHorizontal: 20,
    marginTop: 24,
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
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...cardShadow(),
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  navRowPressed: {
    backgroundColor: Colors.brand.offWhite,
  },
  navLabel: {
    fontSize: 14,
    color: Colors.brand.dark,
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

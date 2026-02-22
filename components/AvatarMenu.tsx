import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, Modal, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth, useLogout } from '@/lib/auth-context';
import Colors from '@/constants/colors';
import { WEB_TOP_INSET } from '@/constants/layout';
import { HeaderAvatar } from '@/components/ScreenHeader';

const MENU_ITEMS = [
  { id: 'profile', label: 'Profile', icon: 'person-outline' as const, route: '/profile' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline' as const, route: '/settings' },
  { id: 'align', label: 'About ALIGN', icon: 'compass-outline' as const, route: '/align-info' },
  { id: 'about', label: 'About This App', icon: 'information-circle-outline' as const, route: '/about-app' },
];

export default function AvatarMenu() {
  const { user } = useAuth();
  const handleLogout = useLogout();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);

  const initials = (user?.name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <HeaderAvatar initials={initials} onPress={() => setMenuVisible(true)} />

      {menuVisible && (
        <Modal
          visible={menuVisible}
          transparent
          animationType="none"
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setMenuVisible(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={() => []}
            >
              <Animated.View
                entering={FadeIn.duration(150)}
                style={[
                  styles.dropdown,
                  { top: insets.top + WEB_TOP_INSET + 52, right: 16 },
                ]}
              >
                <View style={styles.profileRow}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{initials}</Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName} numberOfLines={1}>{user?.name || 'User'}</Text>
                    {user?.calling && <Text style={styles.profileRole} numberOfLines={1}>{user.calling}</Text>}
                  </View>
                </View>

                <View style={styles.divider} />

                {MENU_ITEMS.map((item, idx) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMenuVisible(false);
                      setTimeout(() => router.push(item.route as any), 150);
                    }}
                    style={({ pressed }) => [
                      styles.menuItem,
                      idx < MENU_ITEMS.length - 1 && styles.menuItemBorder,
                      pressed && styles.menuItemPressed,
                    ]}
                  >
                    <Ionicons name={item.icon} size={18} color={Colors.brand.darkGray} />
                    <Text style={styles.menuLabel}>{item.label}</Text>
                  </Pressable>
                ))}

                <View style={styles.divider} />

                <Pressable
                  onPress={() => {
                    setMenuVisible(false);
                    handleLogout();
                  }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <Ionicons name="log-out-outline" size={18} color={Colors.brand.error} />
                  <Text style={[styles.menuLabel, { color: Colors.brand.error }]}>Sign Out</Text>
                </Pressable>
              </Animated.View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dropdown: {
    position: 'absolute',
    width: 230,
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  profileRole: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.brand.lightGray,
    marginHorizontal: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
    marginHorizontal: 0,
  },
  menuItemPressed: {
    backgroundColor: Colors.brand.offWhite,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
});

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';
import { WEB_TOP_INSET, WEB_BOTTOM_INSET } from '@/constants/layout';
import ScreenHeader from '@/components/ScreenHeader';
import AvatarMenu from '@/components/AvatarMenu';

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: string;
  iconSet: 'ionicons' | 'feather' | 'mci';
  iconColor?: string;
  iconBg?: string;
  route?: string;
  action?: 'logout';
  destructive?: boolean;
  comingSoon?: boolean;
}

const MENU_SECTIONS: MenuSection[] = [
  {
    title: 'Features',
    items: [
      {
        id: 'sunday-business',
        label: 'Sunday Business',
        subtitle: 'Conduct releases and sustainings',
        icon: 'script-text-outline',
        iconSet: 'mci',
        iconColor: Colors.brand.primary,
        iconBg: '#E8F4F8',
        route: '/sunday-business',
      },
      {
        id: 'sustainings',
        label: 'Sustainings',
        subtitle: 'Review and provide your sustaining',
        icon: 'hand-left-outline',
        iconSet: 'ionicons',
        iconColor: '#B45309',
        iconBg: '#FEF3C7',
        route: '/sustainings',
      },
      {
        id: 'goals',
        label: 'Goals & Execution',
        subtitle: 'Track stake and ward goals',
        icon: 'target',
        iconSet: 'mci',
        iconColor: Colors.brand.primary,
        iconBg: '#E8F8EE',
        route: '/goals',
      },
      {
        id: 'hc-agenda',
        label: 'High Council Agenda',
        subtitle: 'Meeting agendas and notes',
        icon: 'clipboard-text-outline',
        iconSet: 'mci',
        iconColor: Colors.brand.primary,
        iconBg: '#E8F0F8',
        route: '/high-council-agenda',
      },
      {
        id: 'sc-agenda',
        label: 'Stake Council Agenda',
        subtitle: 'Council meeting management',
        icon: 'document-text-outline',
        iconSet: 'ionicons',
        iconColor: Colors.brand.primary,
        iconBg: '#E8F8F0',
        route: '/stake-council-agenda',
      },
      {
        id: 'assignments',
        label: 'My Assignments',
        subtitle: 'Tasks, deadlines, and stewardship',
        icon: 'check-square',
        iconSet: 'feather',
        iconColor: Colors.brand.primary,
        iconBg: '#F0E8F8',
        route: '/assignments',
      },
      {
        id: 'pulse',
        label: 'ALIGN Pulse',
        subtitle: 'Monthly leadership check-in',
        icon: 'pulse',
        iconSet: 'mci',
        iconColor: Colors.brand.primary,
        iconBg: '#F8F0E8',
        route: '/align-pulse',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        id: 'profile',
        label: 'Profile',
        icon: 'person-outline',
        iconSet: 'ionicons',
        iconColor: Colors.brand.darkGray,
        iconBg: Colors.brand.offWhite,
        route: '/profile',
      },
      {
        id: 'align',
        label: 'About ALIGN',
        icon: 'compass-outline',
        iconSet: 'ionicons',
        iconColor: Colors.brand.darkGray,
        iconBg: Colors.brand.offWhite,
        route: '/align-info',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: 'settings-outline',
        iconSet: 'ionicons',
        iconColor: Colors.brand.darkGray,
        iconBg: Colors.brand.offWhite,
        route: '/settings',
      },
    ],
  },
  {
    title: 'About',
    items: [
      {
        id: 'about',
        label: 'About this App',
        icon: 'information-circle-outline',
        iconSet: 'ionicons',
        iconColor: Colors.brand.darkGray,
        iconBg: Colors.brand.offWhite,
        route: '/about-app',
      },
      {
        id: 'tos',
        label: 'Terms of Service',
        icon: 'document-text-outline',
        iconSet: 'ionicons',
        iconColor: Colors.brand.darkGray,
        iconBg: Colors.brand.offWhite,
        route: '/terms',
      },
    ],
  },
];

function renderIcon(item: MenuItem, size: number) {
  const color = item.iconColor || Colors.brand.primary;
  if (item.iconSet === 'mci') {
    return <MaterialCommunityIcons name={item.icon as any} size={size} color={color} />;
  }
  if (item.iconSet === 'feather') {
    return <Feather name={item.icon as any} size={size - 2} color={color} />;
  }
  return <Ionicons name={item.icon as any} size={size} color={color} />;
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const webTopInset = WEB_TOP_INSET;


  const handlePress = (item: MenuItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.action === 'logout') {
      logout();
    } else if (item.route) {
      router.push(item.route as any);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="More"
        subtitle={user?.calling ? `${user.name}${user.ward ? ` \u00B7 ${user.ward}` : ''}` : undefined}
        rightElement={<AvatarMenu />}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <Pressable
                  key={item.id}
                  onPress={() => handlePress(item)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    idx < section.items.length - 1 && styles.menuItemBorder,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.iconBg }]}>
                    {renderIcon(item, 20)}
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    {item.subtitle && (
                      <Text style={styles.menuSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                    )}
                  </View>
                  {item.comingSoon ? (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>Soon</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          onPress={logout}
          style={({ pressed }) => [
            styles.signOutBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="log-out" size={18} color={Colors.brand.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.version}>SurreyAlign Companion v1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand.midGray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  menuItemPressed: {
    backgroundColor: Colors.brand.offWhite,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  menuSubtitle: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  comingSoonBadge: {
    backgroundColor: Colors.brand.offWhite,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brand.midGray,
    fontFamily: 'Inter_600SemiBold',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 28,
    paddingVertical: 14,
    backgroundColor: Colors.brand.errorLight,
    borderRadius: 12,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.error,
    fontFamily: 'Inter_600SemiBold',
  },
  version: {
    fontSize: 12,
    color: Colors.brand.midGray,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'Inter_400Regular',
  },
});

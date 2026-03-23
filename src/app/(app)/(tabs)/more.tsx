import React, { useMemo, useState } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';
import AppButton from '@/components/ui/AppButton';
import AppListRow from '@/components/ui/AppListRow';
import ScreenHeader from '@/components/ScreenHeader';
import AvatarMenu from '@/components/AvatarMenu';
import { appAlert } from '@/lib/platform-alert';
import { updateAppNow } from '@/lib/pwa-setup';

const LAST_UPDATE_STORAGE_KEY = 'surreyalign:last_manual_update_ms';

function formatUpdateLabel(timestampMs: number, forceJustNow = false): string {
  const timeLabel = new Date(timestampMs).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const ageMs = Date.now() - timestampMs;
  if (forceJustNow || ageMs < 90 * 1000) return `Last update: just now (${timeLabel})`;
  if (ageMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.round(ageMs / (60 * 1000)));
    return `Last update: ${mins}m ago (${timeLabel})`;
  }
  return `Last update: ${timeLabel}`;
}

function readLastUpdateLabel(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_UPDATE_STORAGE_KEY);
    if (!raw) return null;
    const timestampMs = Number(raw);
    if (!Number.isFinite(timestampMs)) return null;
    return formatUpdateLabel(timestampMs);
  } catch {
    return null;
  }
}

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

const ALL_FEATURE_ITEMS: (MenuItem & { visibleTo?: (user: any) => boolean })[] = [
  {
    id: 'sunday-business',
    label: 'Sunday Business',
    subtitle: 'Conduct releases and sustainings',
    icon: 'script-text-outline',
    iconSet: 'mci',
    iconColor: Colors.brand.primary,
    iconBg: '#E8F4F8',
    route: '/sunday-business',
    visibleTo: (u) => u?.is_high_councilor || u?.is_stake_presidency_member || u?.is_executive_secretary || u?.is_bishopric_member,
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
    visibleTo: (u) => u?.is_high_councilor || u?.is_stake_presidency_member || u?.is_executive_secretary || u?.is_bishopric_member,
  },
  {
    id: 'callings',
    label: 'Callings',
    subtitle: 'Calling requests and lifecycle',
    icon: 'people-outline',
    iconSet: 'ionicons',
    iconColor: Colors.brand.primary,
    iconBg: '#E8F4F8',
    route: '/callings',
    visibleTo: (u) => u?.is_high_councilor || u?.is_stake_presidency_member || u?.is_executive_secretary || u?.is_bishopric_member || u?.is_ward_org_president || u?.is_stake_org_president,
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
    visibleTo: (u) => u?.is_stake_presidency_member || u?.is_high_councilor,
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
    visibleTo: (u) => u?.is_stake_presidency_member || u?.is_stake_council_member,
  },
  {
    id: 'assignments',
    label: 'Immediate Tasks',
    subtitle: 'Tasks, deadlines, and stewardship',
    icon: 'check-square',
    iconSet: 'feather',
    iconColor: Colors.brand.primary,
    iconBg: '#F0E8F8',
    route: '/assignments',
  },
  {
    id: 'speaking-assignments',
    label: 'Speaking Assignments',
    subtitle: 'Upcoming speaking schedule',
    icon: 'mic-outline',
    iconSet: 'ionicons',
    iconColor: Colors.brand.primary,
    iconBg: '#F0F4E8',
    route: '/speaking-assignments',
    visibleTo: (u) => u?.is_stake_presidency_member || u?.is_high_councilor || u?.is_stake_council_member || u?.is_stake_org_presidency_member || u?.is_stake_director,
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
];

const ABOUT_SECTION: MenuSection = {
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
};

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
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateLabel, setLastUpdateLabel] = useState<string | null>(() => readLastUpdateLabel());

  const menuSections: MenuSection[] = useMemo(() => {
    const featureItems = ALL_FEATURE_ITEMS
      .filter((item) => !item.visibleTo || item.visibleTo(user))
      .map(({ visibleTo, ...rest }) => rest);

    const sections: MenuSection[] = [];
    if (featureItems.length > 0) {
      sections.push({ title: 'Features', items: featureItems });
    }
    sections.push(ABOUT_SECTION);
    return sections;
  }, [user]);

  const handlePress = (item: MenuItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.action === 'logout') {
      logout();
    } else if (item.route) {
      router.push(item.route as any);
    }
  };

  const handleUpdateAppNow = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    const timestampMs = Date.now();
    setLastUpdateLabel(formatUpdateLabel(timestampMs, true));
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LAST_UPDATE_STORAGE_KEY, String(timestampMs));
      } catch {}
    }
    try {
      const result = await updateAppNow();
      if (result === 'not_supported') {
        appAlert('Update not available', 'This update action is available in the web/PWA app.');
      }
    } finally {
      setTimeout(() => setIsUpdating(false), 2000);
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
      >
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <View key={item.id}>
                  <AppListRow
                    title={item.label}
                    subtitle={item.subtitle}
                    left={<View style={[styles.menuIcon, { backgroundColor: item.iconBg }]}>{renderIcon(item, 20)}</View>}
                    right={item.comingSoon ? (
                      <View style={styles.comingSoonBadge}>
                        <Text style={styles.comingSoonText}>Soon</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
                    )}
                    onPress={() => handlePress(item)}
                  />
                  {idx < section.items.length - 1 ? <View style={styles.menuItemBorder} /> : null}
                </View>
              ))}
            </View>
          </View>
        ))}

        <AppButton
          label={isUpdating ? 'Updating...' : 'Update App Now'}
          onPress={handleUpdateAppNow}
          testID="more-update-app-now-button"
          loading={isUpdating}
          size="large"
          style={styles.updateBtn}
        />
        {lastUpdateLabel ? <Text style={styles.updateMetaText}>{lastUpdateLabel}</Text> : null}

        <AppButton
          label="Sign Out"
          onPress={logout}
          testID="more-signout-button"
          variant="danger"
          size="large"
          style={styles.signOutBtn}
        />

        <Text style={styles.version}>SurreyAlign Companion v1.0.1 (build 2026-02-24.3)</Text>
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
    fontSize: 15,
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
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonBadge: {
    backgroundColor: Colors.brand.offWhite,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.midGray,
    fontFamily: 'Inter_600SemiBold',
  },
  signOutBtn: {
    marginHorizontal: 20,
    marginTop: 12,
  },
  updateBtn: {
    marginHorizontal: 20,
    marginTop: 28,
  },
  updateMetaText: {
    fontSize: 14,
    color: Colors.brand.midGray,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },
  version: {
    fontSize: 14,
    color: Colors.brand.midGray,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'Inter_400Regular',
  },
});

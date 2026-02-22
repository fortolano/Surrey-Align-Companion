import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';
import ScreenHeader from '@/components/ScreenHeader';
import AvatarMenu from '@/components/AvatarMenu';

interface AddMenuItem {
  id: string;
  label: string;
  icon: string;
  iconSet: 'ionicons' | 'mci';
  route: string;
  color: string;
  bgColor: string;
  comingSoon?: boolean;
}

function detectRole(user: any): 'high_councilor' | 'stake_council' | 'bishopric' | 'ward_org_president' | 'other' {
  if (!user) return 'other';

  // Use structured API flags instead of string matching
  if (user.is_stake_admin || user.is_stake_presidency) return 'stake_council';
  if (user.is_high_councilor) return 'high_councilor';
  if (user.is_bishop || user.is_bishopric_member) return 'bishopric';

  // Fall back to calling text for org presidents (no API flag for this)
  const c = (user.calling || '').toLowerCase();
  if (
    (c.includes('president') && !c.includes('counselor') && !c.includes('stake')) &&
    (c.includes('relief society') || c.includes('young women') || c.includes('young men') ||
     c.includes('primary') || c.includes('sunday school') || c.includes('elders quorum'))
  ) return 'ward_org_president';

  return 'other';
}

function getMenuItems(role: string): AddMenuItem[] {
  switch (role) {
    case 'high_councilor':
      return [
        { id: 'hc-agenda', label: 'HC Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/high-council-agenda', color: Colors.brand.primary, bgColor: '#E8F0F8', comingSoon: true},
        { id: 'sc-agenda', label: 'SC Agenda', icon: 'document-text-outline', iconSet: 'ionicons', route: '/stake-council-agenda', color: Colors.brand.primary, bgColor: '#E8F8F0', comingSoon: true},
        { id: 'calling-request', label: 'Calling Request', icon: 'people-outline', iconSet: 'ionicons', route: '/calling-create', color: '#B45309', bgColor: '#FEF3C7' },
        { id: 'note-sp', label: 'Note to SP', icon: 'mail-outline', iconSet: 'ionicons', route: '/assignments', color: '#7C3AED', bgColor: '#F0E8F8', comingSoon: true},
      ];
    case 'stake_council':
      return [
        { id: 'sc-agenda', label: 'SC Agenda Item', icon: 'document-text-outline', iconSet: 'ionicons', route: '/stake-council-agenda', color: Colors.brand.primary, bgColor: '#E8F8F0', comingSoon: true},
        { id: 'my-org-agenda', label: 'My Org Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/assignments', color: Colors.brand.primary, bgColor: '#E8F0F8', comingSoon: true},
        { id: 'calling-request', label: 'Calling Request', icon: 'people-outline', iconSet: 'ionicons', route: '/calling-create', color: '#B45309', bgColor: '#FEF3C7' },
        { id: 'note-sp', label: 'Note to SP', icon: 'mail-outline', iconSet: 'ionicons', route: '/assignments', color: '#7C3AED', bgColor: '#F0E8F8', comingSoon: true},
      ];
    case 'bishopric':
      return [
        { id: 'bishopric-agenda', label: 'Bishopric Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/assignments', color: Colors.brand.primary, bgColor: '#E8F0F8', comingSoon: true},
        { id: 'wc-agenda', label: 'WC Agenda', icon: 'document-text-outline', iconSet: 'ionicons', route: '/assignments', color: Colors.brand.primary, bgColor: '#E8F8F0', comingSoon: true},
        { id: 'calling-request', label: 'Calling Request', icon: 'people-outline', iconSet: 'ionicons', route: '/calling-create', color: '#B45309', bgColor: '#FEF3C7' },
        { id: 'note-sp', label: 'Note to SP', icon: 'mail-outline', iconSet: 'ionicons', route: '/assignments', color: '#7C3AED', bgColor: '#F0E8F8', comingSoon: true},
      ];
    case 'ward_org_president':
      return [
        { id: 'wc-agenda', label: 'WC Agenda', icon: 'document-text-outline', iconSet: 'ionicons', route: '/assignments', color: Colors.brand.primary, bgColor: '#E8F8F0', comingSoon: true},
        { id: 'my-org-agenda', label: 'My Org Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/assignments', color: Colors.brand.primary, bgColor: '#E8F0F8', comingSoon: true},
        { id: 'calling-request', label: 'Calling Request', icon: 'people-outline', iconSet: 'ionicons', route: '/calling-create', color: '#B45309', bgColor: '#FEF3C7' },
        { id: 'note-bishop', label: 'Note to Bishop', icon: 'mail-outline', iconSet: 'ionicons', route: '/assignments', color: '#7C3AED', bgColor: '#F0E8F8', comingSoon: true},
      ];
    default:
      return [
        { id: 'my-org-agenda', label: 'My Org Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/assignments', color: Colors.brand.primary, bgColor: '#E8F0F8', comingSoon: true},
      ];
  }
}

export default function AddScreen() {
  const { user } = useAuth();

  const role = useMemo(() => detectRole(user), [user]);
  const items = useMemo(() => getMenuItems(role), [role]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Create New" subtitle="What would you like to add?" rightElement={<AvatarMenu />} />

      <View style={styles.content}>
        {items.map((item, idx) => (
          <Animated.View key={item.id} entering={FadeInDown.duration(300).delay(idx * 60)}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (item.comingSoon) { Alert.alert('Coming Soon', 'This feature is under development.'); return; }
                router.push(item.route as any);
              }}
              style={({ pressed }) => [
                styles.menuCard,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
              testID={`add-${item.id}`}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.bgColor }]}>
                {item.iconSet === 'mci' ? (
                  <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
                ) : (
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                )}
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 10,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
});

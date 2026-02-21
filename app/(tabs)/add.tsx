import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';

interface AddMenuItem {
  id: string;
  label: string;
  icon: string;
  iconSet: 'ionicons' | 'mci';
  route: string;
  color: string;
  bgColor: string;
}

function detectRole(calling: string | undefined): 'high_councilor' | 'stake_council' | 'bishopric' | 'ward_org_president' | 'other' {
  if (!calling) return 'other';
  const c = calling.toLowerCase();

  if (c.includes('high council') || c.includes('high councilor')) return 'high_councilor';

  if (
    c.includes('stake president') ||
    c.includes('stake relief society') ||
    c.includes('stake young') ||
    c.includes('stake primary') ||
    c.includes('stake sunday school') ||
    (c.includes('stake') && c.includes('president'))
  ) return 'stake_council';

  if (
    c.includes('bishop') ||
    (c.includes('bishopric') && (c.includes('first') || c.includes('second') || c.includes('counselor')))
  ) return 'bishopric';

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
        { id: 'hc-agenda', label: 'HC Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/create-hc-agenda', color: Colors.brand.primary, bgColor: '#E8F0F8' },
        { id: 'sc-agenda', label: 'SC Agenda', icon: 'document-text-outline', iconSet: 'ionicons', route: '/create-sc-agenda', color: Colors.brand.primary, bgColor: '#E8F8F0' },
        { id: 'calling-request', label: 'Calling Request', icon: 'people-outline', iconSet: 'ionicons', route: '/create-calling', color: '#B45309', bgColor: '#FEF3C7' },
        { id: 'note-sp', label: 'Note to SP', icon: 'mail-outline', iconSet: 'ionicons', route: '/create-note-sp', color: '#7C3AED', bgColor: '#F0E8F8' },
      ];
    case 'stake_council':
      return [
        { id: 'sc-agenda', label: 'SC Agenda Item', icon: 'document-text-outline', iconSet: 'ionicons', route: '/create-sc-agenda', color: Colors.brand.primary, bgColor: '#E8F8F0' },
        { id: 'my-org-agenda', label: 'My Org Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/create-org-agenda', color: Colors.brand.primary, bgColor: '#E8F0F8' },
        { id: 'calling-request', label: 'Calling Request', icon: 'people-outline', iconSet: 'ionicons', route: '/create-calling', color: '#B45309', bgColor: '#FEF3C7' },
        { id: 'note-sp', label: 'Note to SP', icon: 'mail-outline', iconSet: 'ionicons', route: '/create-note-sp', color: '#7C3AED', bgColor: '#F0E8F8' },
      ];
    case 'bishopric':
      return [
        { id: 'bishopric-agenda', label: 'Bishopric Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/create-bishopric-agenda', color: Colors.brand.primary, bgColor: '#E8F0F8' },
        { id: 'wc-agenda', label: 'WC Agenda', icon: 'document-text-outline', iconSet: 'ionicons', route: '/create-wc-agenda', color: Colors.brand.primary, bgColor: '#E8F8F0' },
        { id: 'calling-request', label: 'Calling Request', icon: 'people-outline', iconSet: 'ionicons', route: '/create-calling', color: '#B45309', bgColor: '#FEF3C7' },
        { id: 'note-sp', label: 'Note to SP', icon: 'mail-outline', iconSet: 'ionicons', route: '/create-note-sp', color: '#7C3AED', bgColor: '#F0E8F8' },
      ];
    case 'ward_org_president':
      return [
        { id: 'wc-agenda', label: 'WC Agenda', icon: 'document-text-outline', iconSet: 'ionicons', route: '/create-wc-agenda', color: Colors.brand.primary, bgColor: '#E8F8F0' },
        { id: 'my-org-agenda', label: 'My Org Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/create-org-agenda', color: Colors.brand.primary, bgColor: '#E8F0F8' },
        { id: 'calling-request', label: 'Calling Request', icon: 'people-outline', iconSet: 'ionicons', route: '/create-calling', color: '#B45309', bgColor: '#FEF3C7' },
        { id: 'note-bishop', label: 'Note to Bishop', icon: 'mail-outline', iconSet: 'ionicons', route: '/create-note-bishop', color: '#7C3AED', bgColor: '#F0E8F8' },
      ];
    default:
      return [
        { id: 'my-org-agenda', label: 'My Org Agenda', icon: 'clipboard-text-outline', iconSet: 'mci', route: '/create-org-agenda', color: Colors.brand.primary, bgColor: '#E8F0F8' },
      ];
  }
}

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const role = useMemo(() => detectRole(user?.calling), [user?.calling]);
  const items = useMemo(() => getMenuItems(role), [role]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Text style={styles.headerTitle}>Create New</Text>
        <Text style={styles.headerSubtitle}>What would you like to add?</Text>
      </View>

      <View style={styles.content}>
        {items.map((item, idx) => (
          <Animated.View key={item.id} entering={FadeInDown.duration(300).delay(idx * 60)}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
  header: {
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
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

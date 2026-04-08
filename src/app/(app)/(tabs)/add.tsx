import React, { useMemo } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import { useAgendaSubmissionDestinations } from '@/lib/agenda-api';
import Colors from '@/constants/colors';
import { appAlert } from '@/lib/platform-alert';
import { withReturnTarget } from '@/lib/navigation-return-target';
import ScreenHeader from '@/components/ScreenHeader';
import AvatarMenu from '@/components/AvatarMenu';

interface AddMenuItem {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  iconSet: 'ionicons' | 'mci';
  route: string;
  routeParams?: Record<string, string | number | boolean | string[] | undefined | null>;
  color: string;
  bgColor: string;
  comingSoon?: boolean;
}

function detectRole(user: any): 'high_councilor' | 'stake_council' | 'bishopric' | 'ward_org_president' | 'other' {
  if (!user) return 'other';

  if (user.is_stake_admin || user.is_stake_presidency_member) return 'stake_council';
  if (user.is_high_councilor) return 'high_councilor';
  if (user.is_bishop || user.is_bishopric_member) return 'bishopric';
  if (user.is_ward_org_president || user.is_ward_org_presidency_member) return 'ward_org_president';
  if (user.is_executive_secretary) return 'stake_council';

  return 'other';
}

function getBaseMenuItems(role: string): AddMenuItem[] {
  switch (role) {
    case 'high_councilor':
    case 'stake_council':
    case 'bishopric':
      return [
        {
          id: 'calling-request',
          label: 'Calling Request',
          subtitle: 'Start a new calling or release request',
          icon: 'people-outline',
          iconSet: 'ionicons',
          route: '/calling-create',
          color: '#B45309',
          bgColor: '#FEF3C7',
        },
      ];
    case 'ward_org_president':
      return [
        {
          id: 'calling-request',
          label: 'Calling Request',
          subtitle: 'Start a new calling or release request',
          icon: 'people-outline',
          iconSet: 'ionicons',
          route: '/calling-create',
          color: '#B45309',
          bgColor: '#FEF3C7',
        },
        {
          id: 'note-bishop',
          label: 'Note to Bishop',
          subtitle: 'Send a note to your bishop',
          icon: 'mail-outline',
          iconSet: 'ionicons',
          route: '/assignments',
          color: '#7C3AED',
          bgColor: '#F0E8F8',
          comingSoon: true,
        },
      ];
    default:
      return [];
  }
}

export default function AddScreen() {
  const { user } = useAuth();
  const { data: agendaDestinationsData } = useAgendaSubmissionDestinations();

  const role = useMemo(() => detectRole(user), [user]);
  const items = useMemo(() => {
    const destinationCount = agendaDestinationsData?.meta.total ?? 0;
    const agendaItems: AddMenuItem[] = destinationCount > 0
      ? [{
          id: 'agenda-submit',
          label: 'Submit Item to Agenda',
          subtitle: destinationCount === 1
            ? 'Choose the meeting inbox you can submit to'
            : `Choose from ${destinationCount} meeting inboxes you can submit to`,
          icon: 'clipboard-text-outline',
          iconSet: 'mci',
          route: '/agenda-submit',
          color: Colors.brand.primary,
          bgColor: '#E8F8F0',
        }]
      : [];

    return [...agendaItems, ...getBaseMenuItems(role)];
  }, [agendaDestinationsData, role]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Create New" subtitle="What would you like to add?" rightElement={<AvatarMenu />} />

      <View style={styles.content}>
        {items.length > 0 ? items.map((item, idx) => (
          <Animated.View key={item.id} entering={FadeInDown.duration(300).delay(idx * 60)}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (item.comingSoon) {
                  appAlert('Coming Soon', 'This feature is under development.');
                  return;
                }
                router.push(withReturnTarget(item.route, '/add', item.routeParams));
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => [
                styles.menuCard,
                item.comingSoon && styles.menuCardDisabled,
                pressed && !item.comingSoon && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
              testID={`add-${item.id}`}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.bgColor }]}>
                {item.iconSet === 'mci' ? (
                  <MaterialCommunityIcons name={item.icon as any} size={22} color={item.comingSoon ? Colors.brand.midGray : item.color} />
                ) : (
                  <Ionicons name={item.icon as any} size={22} color={item.comingSoon ? Colors.brand.midGray : item.color} />
                )}
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, item.comingSoon && { color: Colors.brand.midGray }]}>{item.label}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              {item.comingSoon ? (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>Soon</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
              )}
            </Pressable>
          </Animated.View>
        )) : (
        <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="clipboard-clock-outline" size={30} color={Colors.brand.primary} />
            <Text style={styles.emptyTitle}>Nothing to add right now</Text>
            <Text style={styles.emptySubtitle}>Agenda submission options and other create actions will appear here when they are available.</Text>
          </View>
        )}
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
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCardDisabled: {
    opacity: 0.55,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  menuSubtitle: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    lineHeight: 19,
  },
  comingSoonBadge: {
    backgroundColor: Colors.brand.sectionBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand.midGray,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
});

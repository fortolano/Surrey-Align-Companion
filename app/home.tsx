import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';

interface TileData {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  color: string;
}

const TILES: TileData[] = [
  {
    id: 'callings',
    title: 'Callings & Releases',
    description: 'Browse current callings by ward and organization',
    icon: <Ionicons name="people-outline" size={26} color="#016183" />,
    route: '/callings',
    color: '#E8F4F8',
  },
  {
    id: 'hc-agenda',
    title: 'High Council Agenda',
    description: 'View and manage High Council meeting agendas',
    icon: <MaterialCommunityIcons name="clipboard-text-outline" size={26} color="#016183" />,
    route: '/high-council-agenda',
    color: '#E8F0F8',
  },
  {
    id: 'sc-agenda',
    title: 'Stake Council Agenda',
    description: 'View and manage Stake Council meeting agendas',
    icon: <Ionicons name="document-text-outline" size={26} color="#016183" />,
    route: '/stake-council-agenda',
    color: '#E8F8F0',
  },
  {
    id: 'assignments',
    title: 'My Assignments',
    description: 'Track your tasks, deadlines, and stewardship areas',
    icon: <Feather name="check-square" size={24} color="#016183" />,
    route: '/assignments',
    color: '#F0E8F8',
  },
  {
    id: 'pulse',
    title: 'ALIGN Pulse',
    description: 'Submit your monthly leadership progress check-in',
    icon: <MaterialCommunityIcons name="pulse" size={26} color="#016183" />,
    route: '/align-pulse',
    color: '#F8F0E8',
  },
];

function FeatureTile({ tile, index }: { tile: TileData; index: number }) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(tile.route as any);
  };

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(100 + index * 80)}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.tile,
          pressed && styles.tilePressed,
        ]}
        testID={`tile-${tile.id}`}
      >
        <View style={[styles.tileIconContainer, { backgroundColor: tile.color }]}>
          {tile.icon}
        </View>
        <View style={styles.tileContent}>
          <Text style={styles.tileTitle}>{tile.title}</Text>
          <Text style={styles.tileDescription}>{tile.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.brand.midGray} />
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const firstName = user?.name?.split(' ')[0] || 'Leader';

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{firstName}</Text>
          </View>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.push('/profile');
            }}
            style={({ pressed }) => [
              styles.profileButton,
              pressed && { opacity: 0.7 },
            ]}
            testID="profile-button"
          >
            <Ionicons name="person-circle-outline" size={32} color={Colors.brand.white} />
          </Pressable>
        </View>
        {user?.calling && (
          <View style={styles.roleChip}>
            <Text style={styles.roleText}>{user.calling}</Text>
            {user.ward && <Text style={styles.wardText}>{user.ward}</Text>}
          </View>
        )}
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + webBottomInset + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Quick Access</Text>
        {TILES.map((tile, index) => (
          <FeatureTile key={tile.id} tile={tile} index={index} />
        ))}
      </ScrollView>
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
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  profileButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  roleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontFamily: 'Inter_500Medium',
  },
  wardText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter_400Regular',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.midGray,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  tilePressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  tileIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tileContent: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    marginBottom: 2,
    fontFamily: 'Inter_600SemiBold',
  },
  tileDescription: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
});

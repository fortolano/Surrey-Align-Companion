import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import Colors from '@/constants/colors';

export default function StakeCouncilAgendaScreen() {
  const insets = useSafeAreaInsets();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[
          styles.content,
          { paddingBottom: insets.bottom + webBottomInset + 24 },
        ]}
      >
        <View style={styles.emptyState}>
          <View style={styles.iconCircle}>
            <Ionicons name="document-text-outline" size={40} color={Colors.brand.primary} />
          </View>
          <Text style={styles.emptyTitle}>Stake Council Agenda</Text>
          <Text style={styles.emptyDescription}>
            View upcoming Stake Council agendas, submit new items for discussion, and review minutes from past meetings.
          </Text>
          <View style={styles.comingSoonBadge}>
            <Ionicons name="time-outline" size={16} color={Colors.brand.primary} />
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: 'Inter_400Regular',
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brand.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  comingSoonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
});

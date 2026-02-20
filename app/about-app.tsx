import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { cardShadow } from '@/constants/styles';

export default function AboutAppScreen() {
  const insets = useSafeAreaInsets();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBottomInset + 32,
          paddingHorizontal: 20,
          paddingTop: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="compass-outline" size={36} color={Colors.brand.primary} />
          </View>
          <Text style={styles.appName}>SurreyAlign</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.card}>
          <Text style={styles.cardTitle}>What is SurreyAlign?</Text>
          <Text style={styles.cardBody}>
            SurreyAlign is a private, internal leadership coordination platform for the Surrey British Columbia Stake of The Church of Jesus Christ of Latter-day Saints.
          </Text>
          <Text style={styles.cardBody}>
            This companion app provides stake and ward leaders with quick mobile access to the tools they use most frequently, especially during in-person meetings and on the go.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.card}>
          <Text style={styles.cardTitle}>Key Features</Text>
          <View style={styles.featureList}>
            <FeatureItem icon="people-outline" text="Callings & Releases directory" />
            <FeatureItem icon="clipboard-outline" text="High Council & Stake Council agendas" />
            <FeatureItem icon="checkmark-circle-outline" text="Personal assignment tracking" />
            <FeatureItem icon="pulse-outline" text="Monthly ALIGN Pulse check-ins" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.card}>
          <Text style={styles.cardTitle}>Data & Privacy</Text>
          <Text style={styles.cardBody}>
            All data is stored securely on SurreyAlign.org. This app does not collect or store personal data beyond your login session. Your credentials are transmitted securely via HTTPS.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <Text style={styles.footerText}>
            Built for the leaders of the Surrey British Columbia Stake.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Ionicons name={icon as any} size={18} color={Colors.brand.primary} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brand.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    fontFamily: 'Inter_700Bold',
  },
  version: {
    fontSize: 13,
    color: Colors.brand.midGray,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...cardShadow(),
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    marginBottom: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  cardBody: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    lineHeight: 21,
    marginBottom: 8,
    fontFamily: 'Inter_400Regular',
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  footerText: {
    fontSize: 12,
    color: Colors.brand.midGray,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },
});

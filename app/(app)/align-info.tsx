import React from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

export default function AlignInfoScreen() {
  const insets = useSafeAreaInsets();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const handleOpenLink = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open('https://surreyalign.org/about?access=surrey2026', '_blank');
    } else {
      Linking.openURL('https://surreyalign.org/about?access=surrey2026');
    }
  };

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
        <Animated.View entering={FadeIn.duration(500)} style={styles.heroCard}>
          <View style={styles.heroIconRow}>
            <MaterialCommunityIcons name="compass-rose" size={28} color={Colors.brand.primary} />
          </View>
          <Text style={styles.heroTitle}>
            Hearts Aligned with Christ,{'\n'}Minds Aligned as One
          </Text>
          <View style={styles.divider} />
          <View style={styles.scriptureBlock}>
            <Ionicons name="book-outline" size={16} color={Colors.brand.primary} style={styles.scriptureIcon} />
            <Text style={styles.scriptureText}>
              &ldquo;And the Lord called his people Zion, because they were of one heart and one mind, and dwelt in righteousness; and there was no poor among them.&rdquo;
            </Text>
          </View>
          <Text style={styles.scriptureRef}>Moses 7:18</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(150)} style={styles.bodyCard}>
          <Text style={styles.bodyText}>
            SurreyAlign is our stake&apos;s shared tool for building Zion together. Goal-setting here works like growing a garden: you plant a seed (your goal), watch for new growth (your Progress Indicator), and give it care each week (your actions).
          </Text>
          <Text style={styles.bodyText}>
            The ALIGN framework is the stewardship checklist that helps you tend every part of that garden, so nothing is forgotten and the effort bears fruit.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.closingCard}>
          <View style={styles.closingQuoteBar} />
          <View style={styles.closingContent}>
            <Text style={styles.closingQuote}>
              &ldquo;Nourish the tree as it beginneth to grow, looking forward to the fruit thereof&rdquo;
            </Text>
            <Text style={styles.closingRef}>Alma 32:41</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(450)}>
          <Pressable
            onPress={handleOpenLink}
            style={({ pressed }) => [
              styles.linkButton,
              pressed && styles.linkButtonPressed,
            ]}
          >
            <Ionicons name="globe-outline" size={20} color={Colors.brand.white} />
            <Text style={styles.linkButtonText}>Learn More on SurreyAlign.org</Text>
            <Ionicons name="open-outline" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  heroCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.brand.primary,
    ...webShadowRgba('rgba(1, 97, 131, 0.1)', 0, 4, 16),
    elevation: 3,
  },
  heroIconRow: {
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '700' as const,
    color: Colors.brand.primary,
    lineHeight: 28,
    fontFamily: 'Inter_700Bold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.brand.lightGray,
    marginVertical: 18,
  },
  scriptureBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  scriptureIcon: {
    marginTop: 2,
  },
  scriptureText: {
    flex: 1,
    fontSize: 15,
    fontStyle: 'italic' as const,
    color: Colors.brand.dark,
    lineHeight: 23,
    fontFamily: 'Inter_400Regular',
  },
  scriptureRef: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.midGray,
    textAlign: 'right',
    marginTop: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  bodyCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    gap: 14,
    ...webShadowRgba('rgba(1, 97, 131, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  bodyText: {
    fontSize: 15,
    color: Colors.brand.dark,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  closingCard: {
    backgroundColor: Colors.brand.accent,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    gap: 14,
  },
  closingQuoteBar: {
    width: 3,
    backgroundColor: Colors.brand.primaryLight,
    borderRadius: 2,
  },
  closingContent: {
    flex: 1,
  },
  closingQuote: {
    fontSize: 15,
    fontStyle: 'italic' as const,
    color: Colors.brand.primaryDark,
    lineHeight: 22,
    fontFamily: 'Inter_500Medium',
  },
  closingRef: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    marginTop: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.brand.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  linkButtonPressed: {
    backgroundColor: Colors.brand.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  linkButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
});

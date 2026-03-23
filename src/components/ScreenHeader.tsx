import React from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { WEB_TOP_INSET } from '@/constants/layout';
import { webShadowRgba } from '@/lib/web-styles';
import AppIconButton from '@/components/ui/AppIconButton';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
}

export default function ScreenHeader({ title, subtitle, rightElement }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + WEB_TOP_INSET + 10;

  return (
    <View style={[styles.header, { paddingTop: topPadding }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        <View style={styles.headerRight}>{rightElement ?? null}</View>
      </View>
    </View>
  );
}

export function HeaderAvatar({ initials, onPress }: { initials: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.avatarBtn,
        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
      ]}
      testID="avatar-menu-btn"
    >
      <Text style={styles.avatarText}>{initials}</Text>
    </Pressable>
  );
}

export function HeaderIconButton({ icon, onPress, testID }: { icon: string; onPress: () => void; testID?: string }) {
  return (
    <AppIconButton
      icon={icon}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      size={22}
      iconColor={Colors.brand.white}
      backgroundColor="rgba(255,255,255,0.2)"
      style={styles.actionBtn}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    ...webShadowRgba('rgba(1, 97, 131, 0.2)', 0, 10, 22),
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerRight: {
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  actionBtn: {
    borderWidth: 0,
  },
});

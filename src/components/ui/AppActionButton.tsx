import React from 'react';
import { StyleSheet, Pressable, Text, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { webShadowRgba } from '@/lib/web-styles';
import { UI_TOUCH_MIN, UI_FONT_INTERACTIVE_MIN, UI_RADIUS_MD } from '@/constants/ui';

interface AppActionButtonProps {
  label: string;
  icon?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
  tone?: 'primary' | 'subtle';
}

export default function AppActionButton({
  label,
  icon = 'arrow-forward-outline',
  onPress,
  style,
  disabled = false,
  testID,
  tone = 'primary',
}: AppActionButtonProps) {
  const subtle = tone === 'subtle';
  const bg = subtle ? Colors.brand.offWhite : Colors.brand.primary;
  const fg = subtle ? Colors.brand.primary : Colors.brand.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        !subtle && styles.elevated,
        {
          backgroundColor: bg,
          borderColor: subtle ? Colors.brand.lightGray : 'transparent',
          opacity: disabled ? 0.5 : 1,
          transform: pressed && !disabled ? [{ scale: 0.98 }] : undefined,
        },
        pressed && !disabled && styles.pressed,
        style,
      ]}
      testID={testID}
    >
      <Ionicons name={icon as any} size={17} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: UI_TOUCH_MIN,
    minWidth: 92,
    borderRadius: UI_RADIUS_MD,
    borderWidth: 1,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  elevated: {
    ...webShadowRgba('rgba(1, 97, 131, 0.14)', 0, 6, 12),
    elevation: 3,
  },
  pressed: {
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 2, 6),
    elevation: 1,
  },
  text: {
    fontSize: UI_FONT_INTERACTIVE_MIN,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});

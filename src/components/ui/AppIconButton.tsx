import React from 'react';
import { Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { webShadowRgba } from '@/lib/web-styles';
import { UI_TOUCH_MIN } from '@/constants/ui';

interface AppIconButtonProps {
  icon: string;
  onPress: () => void;
  size?: number;
  iconColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
}

export default function AppIconButton({
  icon,
  onPress,
  size = 20,
  iconColor = Colors.brand.dark,
  backgroundColor = Colors.brand.offWhite,
  style,
  disabled = false,
  testID,
}: AppIconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={icon.replace(/-/g, ' ').replace(/outline$/, '').trim()}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          opacity: disabled ? 0.45 : 1,
          transform: pressed && !disabled ? [{ scale: 0.96 }] : undefined,
        },
        pressed && !disabled && styles.pressed,
        style,
      ]}
      testID={testID}
    >
      <Ionicons name={icon as any} size={size} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: UI_TOUCH_MIN,
    height: UI_TOUCH_MIN,
    borderRadius: UI_TOUCH_MIN / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  pressed: {
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 2, 6),
    elevation: 1,
  },
});

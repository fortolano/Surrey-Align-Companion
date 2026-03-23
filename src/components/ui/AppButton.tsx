import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, StyleProp, ActivityIndicator } from 'react-native';
import Colors from '@/constants/colors';
import { webShadowRgba } from '@/lib/web-styles';
import { UI_BUTTON_HEIGHT, UI_BUTTON_HEIGHT_LARGE, UI_FONT_INTERACTIVE_MIN, UI_RADIUS_MD } from '@/constants/ui';

type Variant = 'primary' | 'secondary' | 'danger';

type Size = 'default' | 'large';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  loading = false,
  disabled = false,
  style,
  testID,
}: AppButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const height = size === 'large' ? UI_BUTTON_HEIGHT_LARGE : UI_BUTTON_HEIGHT;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        (isPrimary || isDanger) && styles.elevated,
        {
          height,
          backgroundColor: isPrimary
            ? Colors.brand.primary
            : isDanger
            ? Colors.brand.error
            : Colors.brand.offWhite,
          borderColor: isPrimary || isDanger ? 'transparent' : Colors.brand.lightGray,
          opacity: disabled || loading ? 0.55 : 1,
          transform: pressed && !(disabled || loading) ? [{ scale: 0.98 }] : undefined,
        },
        pressed && !(disabled || loading) && styles.pressed,
        style,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary || isDanger ? Colors.brand.white : Colors.brand.primary} />
      ) : (
        <Text
          style={[
            styles.text,
            { color: isPrimary || isDanger ? Colors.brand.white : Colors.brand.primary },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: UI_RADIUS_MD,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  elevated: {
    ...webShadowRgba('rgba(1, 97, 131, 0.16)', 0, 6, 14),
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

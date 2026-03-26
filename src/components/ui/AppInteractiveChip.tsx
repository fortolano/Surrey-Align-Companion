import React from 'react';
import { StyleSheet, Pressable, Text, ViewStyle, StyleProp } from 'react-native';
import Colors from '@/constants/colors';
import { UI_TOUCH_MIN } from '@/constants/ui';

interface AppInteractiveChipProps {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  backgroundColor?: string;
  disabled?: boolean;
  testID?: string;
}

export default function AppInteractiveChip({
  label,
  onPress,
  style,
  textColor = Colors.brand.dark,
  backgroundColor = Colors.brand.white,
  disabled = false,
  testID,
}: AppInteractiveChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: UI_TOUCH_MIN,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});

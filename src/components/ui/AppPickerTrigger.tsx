import React from 'react';
import { StyleSheet, Pressable, Text, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { UI_BUTTON_HEIGHT_LARGE, UI_FONT_INTERACTIVE_MIN, UI_RADIUS_LG } from '@/constants/ui';

interface AppPickerTriggerProps {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export default function AppPickerTrigger({ label, onPress, style, disabled = false }: AppPickerTriggerProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.trigger,
        {
          opacity: disabled ? 0.5 : 1,
          transform: pressed && !disabled ? [{ scale: 0.99 }] : undefined,
        },
        pressed && !disabled && styles.triggerPressed,
        style,
      ]}
    >
      <Text style={styles.text} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={16} color={Colors.brand.darkGray} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: UI_BUTTON_HEIGHT_LARGE,
    borderRadius: UI_RADIUS_LG,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.inputBg,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  triggerPressed: {
    backgroundColor: Colors.brand.offWhite,
  },
  text: {
    flex: 1,
    fontSize: UI_FONT_INTERACTIVE_MIN + 1,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
});

import React from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import Colors from '@/constants/colors';
import { UI_BUTTON_HEIGHT_LARGE, UI_FONT_INTERACTIVE_MIN, UI_RADIUS_LG } from '@/constants/ui';

export default function AppInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.style]}
      placeholderTextColor={props.placeholderTextColor || Colors.brand.midGray}
      selectionColor={props.selectionColor || Colors.brand.primary}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: UI_BUTTON_HEIGHT_LARGE,
    borderRadius: UI_RADIUS_LG,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.inputBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: UI_FONT_INTERACTIVE_MIN + 1,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
});

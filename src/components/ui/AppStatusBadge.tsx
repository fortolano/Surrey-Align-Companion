import React from 'react';
import { StyleSheet, View, Text, ViewStyle, StyleProp } from 'react-native';
import Colors from '@/constants/colors';

interface AppStatusBadgeProps {
  label: string;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

export default function AppStatusBadge({
  label,
  backgroundColor = Colors.brand.sectionBg,
  textColor = Colors.brand.darkGray,
  style,
}: AppStatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor }, style]}>
      <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});

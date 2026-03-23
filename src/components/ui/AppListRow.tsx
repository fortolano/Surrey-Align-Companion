import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle, StyleProp } from 'react-native';
import Colors from '@/constants/colors';
import { UI_TOUCH_MIN } from '@/constants/ui';

interface AppListRowProps {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function AppListRow({ title, subtitle, left, right, onPress, style, testID }: AppListRowProps) {
  const content = (
    <View style={[styles.row, style]} testID={!onPress ? testID : undefined}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: UI_TOUCH_MIN + 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  pressed: {
    opacity: 0.82,
    backgroundColor: Colors.brand.offWhite,
  },
  left: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  right: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

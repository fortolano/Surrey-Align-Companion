import React from 'react';
import { StyleSheet, View, Pressable, Text, StyleProp, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';
import { UI_TOUCH_MIN, UI_FONT_INTERACTIVE_MIN, UI_RADIUS_LG } from '@/constants/ui';

interface SegmentItem {
  key: string;
  label: string;
}

interface AppSegmentedControlProps {
  items: SegmentItem[];
  activeKey: string;
  onChange: (key: string) => void;
  testIDPrefix?: string;
  style?: StyleProp<ViewStyle>;
}

export default function AppSegmentedControl({ items, activeKey, onChange, testIDPrefix, style }: AppSegmentedControlProps) {
  return (
    <View style={[styles.row, style]}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && !active && styles.segmentPressed,
            ]}
            testID={testIDPrefix ? `${testIDPrefix}-${item.key}` : undefined}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: UI_RADIUS_LG + 2,
    backgroundColor: Colors.brand.sectionBg,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  segment: {
    flex: 1,
    minHeight: UI_TOUCH_MIN,
    borderRadius: UI_RADIUS_LG - 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: Colors.brand.primary,
  },
  segmentPressed: {
    backgroundColor: Colors.brand.offWhite,
  },
  label: {
    fontSize: UI_FONT_INTERACTIVE_MIN,
    fontFamily: 'Inter_500Medium',
    color: Colors.brand.darkGray,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
});

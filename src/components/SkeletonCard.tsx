import React, { useEffect } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';

function SkeletonBar({ width, height = 12, style }: { width: string | number; height?: number; style?: any }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { width: width as any, height },
        animStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      <SkeletonBar width="40%" height={10} style={{ marginBottom: 12 }} />
      <SkeletonBar width="85%" height={16} style={{ marginBottom: 8 }} />
      {lines >= 2 && <SkeletonBar width="65%" height={12} style={{ marginBottom: 8 }} />}
      {lines >= 3 && (
        <View style={styles.row}>
          <SkeletonBar width="30%" height={10} />
          <SkeletonBar width="25%" height={10} />
        </View>
      )}
    </View>
  );
}

export function SkeletonList({ count = 4, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  bar: {
    backgroundColor: Colors.brand.lightGray,
    borderRadius: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});

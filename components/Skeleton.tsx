import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, ViewStyle, Animated, Platform } from 'react-native';
import Colors from '@/constants/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBlock({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Colors.brand.lightGray,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={skStyles.card}>
      <View style={skStyles.row}>
        <SkeletonBlock width={48} height={48} borderRadius={12} />
        <View style={skStyles.textCol}>
          <SkeletonBlock width="70%" height={16} />
          <SkeletonBlock width="90%" height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
    </View>
  );
}

export function ListCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={skStyles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={skStyles.listCard}>
          <View style={skStyles.listCardTop}>
            <SkeletonBlock width="55%" height={16} />
            <SkeletonBlock width={60} height={22} borderRadius={6} />
          </View>
          <SkeletonBlock width="80%" height={12} style={{ marginTop: 10 }} />
          <SkeletonBlock width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

export function DetailSkeleton() {
  return (
    <View style={skStyles.detail}>
      <View style={skStyles.detailCard}>
        <SkeletonBlock width="80%" height={22} />
        <SkeletonBlock width={80} height={24} borderRadius={6} style={{ marginTop: 12 }} />
        <View style={[skStyles.row, { marginTop: 12 }]}>
          <SkeletonBlock width={60} height={18} borderRadius={4} />
          <SkeletonBlock width={80} height={18} borderRadius={4} />
        </View>
      </View>
      <View style={skStyles.detailCard}>
        <SkeletonBlock width="40%" height={16} />
        <SkeletonBlock width="100%" height={14} style={{ marginTop: 14 }} />
        <SkeletonBlock width="100%" height={14} style={{ marginTop: 8 }} />
        <SkeletonBlock width="60%" height={14} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

export { SkeletonBlock };

const skStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  textCol: {
    flex: 1,
  },
  list: {
    gap: 10,
  },
  listCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
  listCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detail: {
    gap: 12,
    padding: 16,
  },
  detailCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
  },
});

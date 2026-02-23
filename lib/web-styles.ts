import { Platform, ViewStyle } from 'react-native';

export function webShadow(
  color: string,
  offsetX: number,
  offsetY: number,
  opacity: number,
  radius: number
): ViewStyle {
  if (Platform.OS === 'web') {
    const r = parseInt(color.slice(1, 3), 16) || 0;
    const g = parseInt(color.slice(3, 5), 16) || 0;
    const b = parseInt(color.slice(5, 7), 16) || 0;
    return {
      // @ts-ignore - web-only CSS property
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px rgba(${r}, ${g}, ${b}, ${opacity})`,
    };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: offsetX, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
}

export function webShadowRgba(
  rgba: string,
  offsetX: number,
  offsetY: number,
  radius: number
): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      // @ts-ignore
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px ${rgba}`,
    };
  }
  return {
    shadowColor: rgba,
    shadowOffset: { width: offsetX, height: offsetY },
    shadowOpacity: 1,
    shadowRadius: radius,
  };
}

export const isWeb = Platform.OS === 'web';

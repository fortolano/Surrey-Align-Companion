import { Platform, ViewStyle } from 'react-native';

export const MAX_CONTENT_WIDTH = 500;

export const contentContainer: ViewStyle = {
  width: '100%',
  maxWidth: MAX_CONTENT_WIDTH,
  alignSelf: 'center',
};

export function cardShadow(color = 'rgba(15, 23, 42, 0.08)'): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0 2px 12px ${color}`,
    } as any;
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  };
}

export function elevatedShadow(color = 'rgba(15, 23, 42, 0.12)'): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0 4px 20px ${color}`,
    } as any;
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  };
}

export function buttonShadow(color = 'rgba(1, 97, 131, 0.25)'): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0 4px 14px ${color}`,
    } as any;
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  };
}

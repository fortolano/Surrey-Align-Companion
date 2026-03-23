import { Platform } from 'react-native';

// Platform insets are now handled entirely via CSS (see pwa-setup.ts runtime styles).
// - Browser mode: 100dvh constrains viewport correctly, no extra padding needed.
// - Standalone PWA: @media (display-mode: standalone) adds env(safe-area-inset-*) padding.
// These JS constants are kept at 0; they exist only for backward compatibility
// with components that reference them for content padding (e.g. scroll content).
export const WEB_TOP_INSET = Platform.OS === 'web' ? 0 : 0;
export const WEB_BOTTOM_INSET = Platform.OS === 'web' ? 0 : 0;

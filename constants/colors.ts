const brand = {
  primary: "#016183",
  primaryDark: "#01495f",
  primaryLight: "#0289B5",
  accent: "#E8F4F8",
  accentWarm: "#F0F7FA",
  white: "#FFFFFF",
  offWhite: "#F8FAFB",
  lightGray: "#EEF2F5",
  midGray: "#94A3B8",
  darkGray: "#475569",
  dark: "#1E293B",
  black: "#0F172A",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  errorLight: "#FEF2F2",
};

export default {
  brand,
  light: {
    text: brand.black,
    textSecondary: brand.darkGray,
    textMuted: brand.midGray,
    background: brand.offWhite,
    surface: brand.white,
    tint: brand.primary,
    tabIconDefault: brand.midGray,
    tabIconSelected: brand.primary,
    border: brand.lightGray,
    cardShadow: "rgba(1, 97, 131, 0.08)",
  },
};

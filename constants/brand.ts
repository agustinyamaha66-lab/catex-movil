import { Platform } from "react-native";

const fontDisplay = Platform.select({
  ios: "AvenirNext-DemiBold",
  android: "sans-serif-condensed",
  default: "sans-serif",
});

const fontBody = Platform.select({
  ios: "AvenirNext-Regular",
  android: "sans-serif",
  default: "sans-serif",
});

const fontLabel = Platform.select({
  ios: "AvenirNext-Medium",
  android: "sans-serif-medium",
  default: "sans-serif",
});

export const Brand = {
  colors: {
    ink: "#0B1F33",
    inkSoft: "#1F2A44",
    muted: "#64748B",
    subtle: "#94A3B8",
    surface: "#FFFFFF",
    background: "#F2F6FB",
    border: "#D7E2F0",
    primary: "#1D4ED8",
    primarySoft: "#DBEAFE",
    accent: "#14B8A6",
    accentSoft: "#CCFBF1",
    warning: "#F59E0B",
    warningSoft: "#FEF3C7",
    success: "#16A34A",
    successSoft: "#DCFCE7",
    danger: "#EF4444",
    dangerSoft: "#FEE2E2",
    navy: "#0F254A",
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    pill: 999,
  },
  fonts: {
    display: fontDisplay,
    body: fontBody,
    label: fontLabel,
  },
  shadow: {
    card: Platform.select({
      ios: {
        shadowColor: "#0B1F33",
        shadowOpacity: 0.1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: "#0B1F33",
        shadowOpacity: 0.1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
    float: Platform.select({
      ios: {
        shadowColor: "#0B1F33",
        shadowOpacity: 0.16,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 16 },
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: "#0B1F33",
        shadowOpacity: 0.16,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 16 },
      },
    }),
  },
};

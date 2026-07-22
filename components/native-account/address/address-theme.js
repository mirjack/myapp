import { StyleSheet } from "react-native";

import { BrandColors } from "@/constants/theme";

export const addressPalette = {
  brand: BrandColors.primary,
  brandSoft: BrandColors.primarySoft,
  text: BrandColors.text,
  secondaryText: BrandColors.secondaryText,
  surface: "#FFFFFF",
  mutedSurface: BrandColors.surfaceMuted,
  divider: BrandColors.divider,
  overlay: "rgba(19, 19, 20, 0.12)",
  danger: "#C82F4E",
};

export const addressSharedStyles = StyleSheet.create({
  shadow: {
    shadowColor: "#131314",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});

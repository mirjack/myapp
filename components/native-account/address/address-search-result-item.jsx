import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { addressPalette } from "./address-theme";

export function AddressSearchResultItem({
  chevron,
  isFirst,
  onPress,
  subtitle,
  title,
}) {
  return (
    <Pressable onPress={onPress} style={[styles.item, !isFirst && styles.itemBorder]}>
      <View style={styles.textWrap}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {chevron ? <Ionicons color={addressPalette.secondaryText} name="chevron-forward" size={24} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: addressPalette.divider,
  },
  textWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    color: addressPalette.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 21,
    color: addressPalette.secondaryText,
  },
});

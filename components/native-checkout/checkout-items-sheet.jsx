import { Modal, Pressable, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useTranslation } from "react-i18next";

import {
  formatCurrency,
  getColorHex,
  getColorLabel,
  getItemUnitFinalPrice,
} from "@/components/native-checkout/checkout-data";
import { styles } from "@/components/native-checkout/checkout-styles";

export function CheckoutItemsSheet({
  visible,
  items,
  onClose,
  onOpenProduct,
  bottomInset,
}) {
  const { t } = useTranslation();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheetRoot, { paddingBottom: Math.max(12, bottomInset) }]}>
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>{t("ui.checkout.itemsTitle")}</Text>
          {items.map((item) => {
            const product = item?.product ?? {};
            const quantity = Number(item?.quantity) || 1;
            const totalPrice = getItemUnitFinalPrice(item) * quantity;
            return (
              <Pressable
                key={String(item.id)}
                onPress={() => onOpenProduct(item)}
                style={styles.sheetItem}
              >
                <View style={styles.sheetImageWrap}>
                  <ExpoImage
                    source={{ uri: product.image || product.image_url }}
                    style={styles.sheetImage}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.sheetItemInfo}>
                  <Text numberOfLines={2} style={styles.sheetItemTitle}>
                    {product.name || "Товар"}
                  </Text>
                  <View style={styles.sheetMetaRow}>
                    <Text style={styles.sheetMetaLabel}>{t("ui.checkout.quantity")}</Text>
                    <View style={styles.sheetMetaValueWrap}>
                      <View style={styles.quantityBadge}>
                        <Text style={styles.quantityBadgeText}>{quantity}</Text>
                      </View>
                      <View style={styles.sheetDivider} />
                      <Text style={styles.sheetMetaValue}>{formatCurrency(totalPrice)}</Text>
                    </View>
                  </View>
                  <View style={styles.sheetMetaRow}>
                    <Text style={styles.sheetMetaLabel}>{t("ui.checkout.color")}</Text>
                    <View style={styles.sheetMetaValueWrap}>
                      <View style={[styles.colorSwatch, { backgroundColor: getColorHex(product) }]} />
                      <Text style={styles.sheetMetaValue}>{getColorLabel(product)}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={onClose} style={styles.sheetCloseButton}>
          <Text style={styles.sheetCloseText}>{t("ui.checkout.close")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

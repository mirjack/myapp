import { Image as ExpoImage } from "expo-image";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  formatCurrency,
} from "@/components/native-checkout/checkout-data";
import { Icon } from "@/components/native-checkout/checkout-icons";
import {
  ACCENT_COLOR,
  styles,
} from "@/components/native-checkout/checkout-styles";

function Section({ children, first, padded = true }) {
  return (
    <View
      style={[
        styles.section,
        first ? styles.firstSection : null,
        padded ? styles.sectionPadded : null,
      ]}
    >
      {children}
    </View>
  );
}

export function CheckoutHeader({ insets, onBack }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Icon name="back" size={24} color={ACCENT_COLOR} />
          <Text style={styles.backText}>{t("ui.checkout.back")}</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {t("ui.checkout.itemsTitle")}
        </Text>
        <View style={styles.headerSide} />
      </View>
    </View>
  );
}

export function DeliverySection({ addressLabel, onPress }) {
  const { t } = useTranslation();
  return (
    <Section first>
      <Text style={styles.sectionTitle}>{t("ui.checkout.deliveryTitle")}</Text>
      <Pressable onPress={onPress} style={styles.deliveryRow}>
        <View style={styles.deliveryIcon}>
          <Icon name="delivery" size={20} color="#0B0B0B" />
        </View>
        <View style={styles.deliveryTextBlock}>
          <Text style={styles.deliveryTitle}>{t("ui.checkout.deliveryAction")}</Text>
          <Text numberOfLines={1} style={styles.deliverySubtitle}>
            {addressLabel || t("ui.checkout.savedAddressPlaceholder")}
          </Text>
        </View>
        <View style={styles.deliveryChevron}>
          <Icon name="chevron-right" size={16} color="#7C7C7C" />
        </View>
      </Pressable>
    </Section>
  );
}

export function ItemsSection({ items, onOpenProduct, onShowAll }) {
  const { t } = useTranslation();
  return (
    <Section>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t("ui.checkout.itemsTitle")}</Text>
        <Pressable onPress={onShowAll} style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>{t("ui.checkout.viewAll")}</Text>
          <Icon name="chevron-right" size={12} color={ACCENT_COLOR} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.previewList}
      >
        {items.slice(0, 4).map((item) => (
          <Pressable
            key={String(item.id)}
            onPress={() => onOpenProduct(item)}
            style={styles.previewItem}
          >
            <ExpoImage
              source={{ uri: item?.product?.image || item?.product?.image_url }}
              style={styles.previewImage}
              contentFit="cover"
            />
          </Pressable>
        ))}
      </ScrollView>
      {items.length > 4 ? (
        <Pressable onPress={onShowAll} style={styles.itemsSheetButton}>
          <Text style={styles.itemsSheetButtonText}>{t("ui.checkout.showAllItems")}</Text>
        </Pressable>
      ) : null}
    </Section>
  );
}

function RadioIndicator({ checked }) {
  return (
    <View style={[styles.radio, checked ? styles.radioActive : null]}>
      {checked ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

export function PaymentSection({ paymentRows, paymentMethod, onChange }) {
  const { t } = useTranslation();
  return (
    <Section>
      <Text style={styles.sectionTitle}>{t("ui.checkout.paymentMethod")}</Text>
      <View style={styles.paymentList}>
        {paymentRows.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={styles.paymentRow}
          >
            <View style={styles.paymentRadioSlot}>
              <RadioIndicator checked={paymentMethod === option.value} />
            </View>
            <View style={styles.paymentIconSlot}>
              <Icon name={option.icon} size={20} color="#1B1C1F" />
            </View>
            <View style={styles.paymentTextBlock}>
              <Text style={styles.paymentTitle}>{option.title}</Text>
              <Text style={styles.paymentDescription}>
                {option.description}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

export function BonusSection({
  useBonuses,
  onToggle,
  availableBonuses,
}) {
  const { t } = useTranslation();
  return (
    <Section padded={false}>
      <View style={styles.bonusTop}>
        <Text style={styles.sectionTitle}>{t("ui.checkout.bonusPayment")}</Text>
        <View style={styles.bonusRow}>
          <View style={styles.bonusIcon}>
            <Icon name="points" size={20} />
          </View>
          <View style={styles.bonusTextBlock}>
            <Text style={styles.bonusTitle}>{t("ui.checkout.useBonuses")}</Text>
            <Text style={styles.bonusDescription}>{t("ui.checkout.bonusDescription")}</Text>
          </View>
          <Switch
            value={useBonuses}
            onValueChange={onToggle}
            trackColor={{ false: "#D7D8DD", true: ACCENT_COLOR }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
      <View style={styles.bonusInputWrap}>
        <Text style={styles.bonusHint}>{t("ui.checkout.balance", { amount: formatCurrency(availableBonuses) })}</Text>
        {useBonuses ? <Text style={styles.bonusHint}>{t("ui.checkout.serverBonuses")}</Text> : null}
      </View>
    </Section>
  );
}

function SummaryRow({ icon, label, value, badge }) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryLabelWrap}>
        <Icon name={icon} size={20} color="#757575" />
        <Text numberOfLines={1} style={styles.summaryLabel}>
          {label}
        </Text>
      </View>
      <View style={styles.summaryValueWrap}>
        {badge ? (
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

export function SummarySection({ totals, appliedBonuses, finalTotal, pendingBonuses }) {
  const { t } = useTranslation();
  return (
    <Section>
      <Text style={styles.sectionTitle}>{t("ui.checkout.paymentMethod")}</Text>
      <View style={styles.summaryList}>
        <SummaryRow
          icon="bag"
            label={t("ui.checkout.summaryItems")}
          badge={totals.quantity > 0 ? String(totals.quantity) : null}
          value={formatCurrency(totals.subtotal)}
        />
        <SummaryRow
          icon="tag"
            label={t("ui.checkout.discount")}
          value={`-${formatCurrency(totals.discount)}`}
        />
        <SummaryRow
          icon="delivery"
            label={t("ui.checkout.delivery")}
          value={formatCurrency(totals.shipping)}
        />
        <SummaryRow
          icon="points"
            label={t("ui.checkout.withBonuses")}
          value={pendingBonuses ? t("ui.checkout.calculatedAtOrder") : formatCurrency(appliedBonuses)}
        />
        <View style={styles.summarySeparator} />
        <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t(pendingBonuses ? "ui.checkout.totalBeforeBonuses" : "ui.checkout.total")}</Text>
          <Text style={styles.totalValue}>{formatCurrency(finalTotal)}</Text>
        </View>
      </View>
    </Section>
  );
}

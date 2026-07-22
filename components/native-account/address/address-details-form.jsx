import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { addressPalette } from "./address-theme";

function Field({
  compact = false,
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A6A6AC"
        style={[styles.input, compact && styles.compactInput, multiline && styles.textArea]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

function AddressSelector({ address, onPress }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>Address</Text>
      <Pressable onPress={onPress} style={styles.addressPicker}>
        <Text numberOfLines={3} style={[styles.inputText, !address && styles.inputPlaceholder]}>
          {address || "Select an address"}
        </Text>
        <Ionicons color={addressPalette.secondaryText} name="search-outline" size={20} />
      </Pressable>
    </View>
  );
}

export function AddressDetailsForm({
  address,
  error,
  form,
  isSubmitting,
  layout = "default",
  onAddressPress,
  onChangeField,
  onSubmit,
  showSubmitButton = true,
}) {
  const isDetailsLayout = layout === "details";

  return (
    <View style={isDetailsLayout ? styles.detailsForm : null}>
      {!isDetailsLayout ? (
        <AddressSelector address={address} onPress={onAddressPress} />
      ) : null}

      {isDetailsLayout ? (
        <Field
          label="Address name"
          onChangeText={(value) => onChangeField("title", value)}
          placeholder="Home, Office, Mom's place"
          value={form.title}
        />
      ) : (
        <Field
          label="Address name"
          onChangeText={(value) => onChangeField("title", value)}
          placeholder="Home, Office, Mom's place"
          value={form.title}
        />
      )}

      <View style={[styles.row, isDetailsLayout && styles.detailsTripleRow]}>
        <View style={isDetailsLayout ? styles.thirdField : styles.halfField}>
          <Field
            label="Apartment / office"
            onChangeText={(value) => onChangeField("apartment", value)}
            placeholder="Apartment"
            value={form.apartment}
          />
        </View>
        <View style={isDetailsLayout ? styles.thirdField : styles.halfField}>
          <Field
            label="Entrance"
            onChangeText={(value) => onChangeField("entrance", value)}
            placeholder="Entrance"
            value={form.entrance}
          />
        </View>
        {isDetailsLayout ? (
          <View style={styles.thirdField}>
            <Field
              label="Floor"
              onChangeText={(value) => onChangeField("floor", value)}
              placeholder="Floor"
              value={form.floor}
            />
          </View>
        ) : null}
      </View>

      {!isDetailsLayout ? (
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Field
              label="Floor"
              onChangeText={(value) => onChangeField("floor", value)}
              placeholder="Floor"
              value={form.floor}
            />
          </View>
        </View>
      ) : null}

      <Field
        label="Courier instructions"
        multiline
        onChangeText={(value) => onChangeField("courierComment", value)}
        placeholder="Add a note for the courier"
        value={form.courierComment}
      />

      {isDetailsLayout ? (
        <Text style={styles.helperText}>
          This helps the courier find you faster.
        </Text>
      ) : null}

      {isDetailsLayout ? (
        <View style={styles.defaultRow}>
          <Text style={styles.defaultLabel}>Set default</Text>
          <Switch
            onValueChange={(value) => onChangeField("isDefault", value)}
            thumbColor="#FFFFFF"
            trackColor={{ false: "#D8D8DE", true: addressPalette.brand }}
            value={Boolean(form.isDefault)}
          />
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {showSubmitButton ? (
        <Pressable disabled={isSubmitting} onPress={onSubmit} style={({ pressed }) => [styles.submitButton, isSubmitting && styles.submitButtonDisabled, pressed && styles.submitButtonPressed]}>
          {isSubmitting ? (
            <ActivityIndicator color="#131314" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Deliver here</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 10,
  },
  detailsForm: {
    marginTop: 18,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  detailsTripleRow: {
    alignItems: "flex-start",
  },
  halfField: {
    flex: 1,
  },
  thirdField: {
    flex: 1,
  },
  singleField: {
    marginTop: 2,
  },
  label: {
    marginBottom: 5,
    fontSize: 13,
    fontWeight: "500",
    color: addressPalette.text,
  },
  input: {
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: addressPalette.mutedSurface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: addressPalette.text,
  },
  addressPicker: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: addressPalette.mutedSurface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: addressPalette.text,
  },
  inputPlaceholder: {
    color: "#A6A6AC",
  },
  textArea: {
    minHeight: 64,
  },
  helperText: {
    marginTop: 2,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    color: addressPalette.secondaryText,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  defaultLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: addressPalette.text,
  },
  errorText: {
    marginBottom: 10,
    fontSize: 12,
    lineHeight: 16,
    color: addressPalette.danger,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: addressPalette.brand,
    marginTop: 2,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

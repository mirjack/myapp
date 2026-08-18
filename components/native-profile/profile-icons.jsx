import { Image } from "react-native";
import { SvgUri } from "react-native-svg";

const profileIconAssets = {
  orderHistory: require("@/assets/icons/profile/order-history.svg"),
  addresses: require("@/assets/icons/profile/addresses.svg"),
  chat: require("@/assets/icons/profile/chat.svg"),
  notifications: require("@/assets/icons/profile/notifications.svg"),
  telegram: require("@/assets/icons/profile/telegram.svg"),
  instagram: require("@/assets/icons/profile/instagram.svg"),
  youtube: require("@/assets/icons/profile/youtube.svg"),
  phone: require("@/assets/icons/profile/phone.svg"),
  terms: require("@/assets/icons/profile/terms.svg"),
  termsVerified: require("@/assets/icons/profile/terms-verified.svg"),
};

export const profileIconNames = new Set(Object.keys(profileIconAssets));

export function ProfileSvgIcon({ name, size = 22 }) {
  const source = Image.resolveAssetSource(profileIconAssets[name]);
  if (!source?.uri) return null;

  return <SvgUri uri={source.uri} width={size} height={size} />;
}

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { supportStyles } from "@/components/support-chat/styles";

export function SupportHeader({
  title = "Support",
  metaText = "",
  fallbackHref,
  badgeLabel = "",
  hideBell = false,
  showAvatar = false,
  avatarUri = null,
  avatarLabel = "S",
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[supportStyles.headerWrap, { paddingTop: insets.top - 2 }]}>
      <View style={supportStyles.header}>
        <View style={supportStyles.headerSide}>
          <Pressable
            onPress={() => {
              if (
                typeof router.canGoBack === "function" &&
                router.canGoBack()
              ) {
                router.back();
                return;
              }
              if (fallbackHref) {
                router.replace(fallbackHref);
              }
            }}
            style={supportStyles.headerBack}
          >
            <Ionicons name="chevron-back" size={20} color="#FE946E" />
          </Pressable>
        </View>
        <View style={supportStyles.headerTitleWrap}>
          <View style={supportStyles.headerTitleRow}>
            {showAvatar ? (
              avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={supportStyles.headerAvatarImage}
                />
              ) : (
                <View style={supportStyles.headerAvatar}>
                  <Text style={supportStyles.headerAvatarText}>
                    {String(avatarLabel || "S")
                      .trim()
                      .slice(0, 1)
                      .toUpperCase() || "S"}
                  </Text>
                </View>
              )
            ) : null}
            <Text style={supportStyles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>
        <View style={[supportStyles.headerSide, supportStyles.headerSideRight]}>
          {badgeLabel ? (
            <View style={supportStyles.headerBadge}>
              <Ionicons name="bag-handle" size={12} color="#FE946E" />
              <Text style={supportStyles.headerBadgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
          {!hideBell ? (
            <Svg
              xmlns="http://www.w3.org/2000/svg"
              width="19"
              height="20"
              viewBox="0 0 19 20"
              fill="none"
            >
              <Path
                d="M6.205 14.832C8.10301 15.0571 10.021 15.0571 11.919 14.832C13.7822 14.6114 15.6129 14.1717 17.373 13.522C15.8824 11.8708 15.0587 9.7245 15.062 7.5V6.75C15.062 5.1587 14.4299 3.63258 13.3046 2.50736C12.1794 1.38214 10.6533 0.75 9.062 0.75C7.4707 0.75 5.94458 1.38214 4.81936 2.50736C3.69414 3.63258 3.062 5.1587 3.062 6.75V7.5C3.06502 9.72463 2.24099 11.871 0.75 13.522C2.483 14.162 4.31 14.607 6.205 14.832ZM11.919 14.832C12.0631 15.2819 12.0989 15.7594 12.0236 16.2257C11.9482 16.692 11.7638 17.134 11.4854 17.5156C11.2069 17.8972 10.8423 18.2076 10.4212 18.4216C10.0001 18.6356 9.53438 18.7472 9.062 18.7472C8.58962 18.7472 8.12392 18.6356 7.70281 18.4216C7.28169 18.2076 6.91707 17.8972 6.63862 17.5156C6.36017 17.134 6.17576 16.692 6.10041 16.2257C6.02506 15.7594 6.0609 15.2819 6.205 14.832"
                stroke="#0B0B0B"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : null}
        </View>
      </View>
    </View>
  );
}

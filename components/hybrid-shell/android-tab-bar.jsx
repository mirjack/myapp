import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ANDROID_TAB_ITEMS } from "./constants";
import { AndroidTabButton } from "./android-tab-button";
import { styles } from "./styles";

let lastActiveAndroidTabKey = "home";

function getTabIndex(tabKey) {
  const foundIndex = ANDROID_TAB_ITEMS.findIndex((tab) => tab.key === tabKey);
  return foundIndex >= 0 ? foundIndex : 0;
}

export function AndroidTabBar({
  activeTabKey = "home",
  cartCount = 0,
  onTabPress,
}) {
  const { t } = useTranslation();
  const [androidTabBarWidth, setAndroidTabBarWidth] = useState(0);
  const initialTabIndex = getTabIndex(lastActiveAndroidTabKey);
  const activeTabIndexAnim = useSharedValue(initialTabIndex);

  const androidItemWidth = useMemo(() => {
    const innerWidth = Math.max(0, androidTabBarWidth - 8);
    return innerWidth / ANDROID_TAB_ITEMS.length;
  }, [androidTabBarWidth]);

  useEffect(() => {
    activeTabIndexAnim.value = withTiming(getTabIndex(activeTabKey), {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    lastActiveAndroidTabKey = activeTabKey;
  }, [activeTabIndexAnim, activeTabKey]);

  const androidActiveBgStyle = useAnimatedStyle(() => ({
    width: androidItemWidth,
    transform: [
      { translateX: 4 + activeTabIndexAnim.value * androidItemWidth },
    ],
    opacity: androidItemWidth > 0 ? 1 : 0,
  }));

  return (
    <View style={styles.androidTabBarWrap}>
      <View
        style={styles.androidTabBar}
        onLayout={(event) => {
          setAndroidTabBarWidth(event.nativeEvent.layout.width);
        }}
      >
        <Animated.View
          style={[styles.androidTabActivePill, androidActiveBgStyle]}
        />
        {ANDROID_TAB_ITEMS.map((tab) => (
          <AndroidTabButton
            key={tab.key}
            tab={{ ...tab, label: t(tab.labelKey) }}
            isActive={tab.key === activeTabKey}
            cartCount={Number(cartCount || 0)}
            onPress={() => onTabPress?.(tab.key)}
          />
        ))}
      </View>
    </View>
  );
}

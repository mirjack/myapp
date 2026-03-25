import { Platform } from "react-native";
import { Slot } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
  if (Platform.OS === "android") {
    return <Slot />;
  }

  return (
    <NativeTabs
      disableTransparentOnScrollEdge
      minimizeBehavior={Platform.OS === "ios" ? "onScrollDown" : undefined}
      blurEffect={Platform.OS === "ios" ? "systemChromeMaterial" : undefined}
      iconColor={{ default: "#757575", selected: "#FE946E" }}
      labelStyle={{
        default: { color: "#757575", fontSize: 11, fontWeight: "500" },
        selected: { color: "#FE946E", fontSize: 11, fontWeight: "600" },
      }}
    >
      <NativeTabs.Trigger name="index">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="catalog">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="grid-outline" />,
            selected: <VectorIcon family={Ionicons} name="grid" />,
          }}
        />
        <Label>Catalog</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cart">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="bag-outline" />,
            selected: <VectorIcon family={Ionicons} name="bag" />,
          }}
        />
        <Label>Cart</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="favorites">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="heart-outline" />,
            selected: <VectorIcon family={Ionicons} name="heart" />,
          }}
        />
        <Label>Favorites</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="person-outline" />,
            selected: <VectorIcon family={Ionicons} name="person" />,
          }}
        />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

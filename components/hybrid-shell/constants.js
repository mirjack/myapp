import { WEBVIEW_BASE_URL } from "@/lib/runtime-config";

export const BASE_URL = WEBVIEW_BASE_URL.replace(/\/$/, "");
export const INITIAL_WEB_URL = `${BASE_URL}/`;
export const BOTTOM_SHEET_CLOSE_EVENT = "native:bottomSheetClose";
export const BOTTOM_SHEET_ACTION_EVENT = "native:bottomSheetAction";
export const NATIVE_SHEET_CLOSE_MS = 280;
export const PRODUCT_SHEET_KEY = "product_detail";
export const PRODUCT_SHEET_REQUEST_ID = "native-product-detail";

export const ROUTE_GUARD_PATHS = new Set(["/cart", "/favorites", "/profile"]);
export const LOGIN_PATH_PREFIXES = ["/login", "/register", "/onboarding"];
export const LOADING_BACKGROUND_COLOR = "#F8F8F8";

export const HEADER_CONTENT_HEIGHT = 67;
export const ANDROID_TAB_WRAP_HEIGHT = 98;

export const ROOT_PATHS = new Set(["/", "/catalog", "/cart", "/favorites", "/profile"]);
export const HEADER_VISIBLE_PATHS = [
  "/",
  "/home",
  "/catalog",
  "/cart",
  "/favorites",
  "/favorite",
  "/profile",
  "/loyalty",
  "/language",
];

export const ANDROID_TAB_ITEMS = [
  { key: "home", label: "Home", path: "/" },
  { key: "catalog", label: "Catalog", path: "/catalog" },
  { key: "cart", label: "Cart", path: "/cart" },
  {
    key: "favorites",
    label: "Favorites",
    path: "/favorites",
    match: ["/favorite"],
  },
  { key: "profile", label: "Profile", path: "/profile" },
];

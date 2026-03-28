# Welcome to your Expo app 👋

## Current Hybrid Context (March 25, 2026)

- `myapp` uses Expo Router **native tabs** (`expo-router/unstable-native-tabs`) in `app/(tabs)/_layout.jsx`.
- iOS uses Expo Router native tabs (Liquid Glass style).
- Android uses a custom native tab bar in `components/hybrid-shell.jsx` (web `mobile-navigation` look), while web `mobile-navigation` is hidden in native Android.
- Each tab route (`index`, `catalog`, `cart`, `favorites`, `profile`) renders `components/hybrid-shell.jsx` with its target web path.
- Native top header is rendered in `components/hybrid-shell.jsx` (brand + login/wallet chip) to match app-only shell UX.
- Auth tokens from web (`localStorage.authTokens`) are mirrored into native `SecureStore` via `onMessage`.
- On startup, native injects stored tokens back into WebView before content load.
- Native injects platform flag into WebView:
  - `window.__NATIVE_APP__ = true`
  - `window.__NATIVE_PLATFORM__ = "ios" | "android"`
- External links are opened in system browser (`expo-web-browser`).
- iOS tab bar uses system material (`blurEffect="systemChromeMaterial"` + native minimize behavior).

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start Metro for development build / dev client (recommended)

   ```bash
   npm run start:dev-client
   ```

3. Build and install development client (Android first)

   ```bash
   npm run build:dev:android
   ```

   or local native run:

   ```bash
   npm run android:dev
   ```

4. Optional iOS development client build

   ```bash
   npm run build:dev:ios
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox (not the primary workflow for this hybrid shell)

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## iOS (TestFlight / App Store) ga chiqarish

Bu loyiha Expo + EAS Build ishlatadi. Windows’da iOS build’ni lokal qilolmaysiz — iOS uchun EAS cloud build’dan foydalanasiz.

1. Expo account’ga kiring:

   ```bash
   npx expo login
   ```

2. Apple Developer account (pullik) kerak bo‘ladi: App Store Connect’ga kirish va “Certificates/Identifiers/Profiles”.

3. iOS bundle id va build number sozlangan:
   - `app.json` → `expo.ios.bundleIdentifier`
   - `app.json` → `expo.ios.buildNumber` (har release’da +1 qiling)

4. iOS build (TestFlight uchun “internal”):

   ```bash
   npm run build:ios
   ```

5. App Store / TestFlight (store distribution):

   ```bash
   npm run build:ios:prod
   ```

6. Submit (App Store Connect’ga yuborish):

   ```bash
   eas submit -p ios --latest
   ```

Eslatma: Agar app biror permission ishlatsa (kamera, fotosuratlar, lokatsiya), iOS uchun `NS*UsageDescription` matnlarini `app.json` ichidagi `expo.ios.infoPlist` orqali qo‘shish kerak bo‘ladi.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

hybrid-market-app-rn/
├── App.tsx ← Provider chain entry point
├── package.json ← Expo 52 + all deps
├── app.json, babel.config.js, tsconfig.json
└── src/
├── config.ts ← WEB_BASE_URL, TABS map, heights
├── navigation/
│ ├── types.ts ← RootStackParamList
│ └── AppNavigator.tsx ← Splash → Main stack
├── auth/
│ ├── storage.ts ← expo-secure-store wrapper
│ └── AuthContext.tsx ← login/logout + token sync
├── bridge/
│ ├── types.ts ← WebToNativeMessage / NativeToWebMessage
│ ├── BridgeHandler.ts ← Web→Native: parses & dispatches messages
│ └── NativeBridge.ts ← Native→Web: injects JS into WebView
├── webview/
│ ├── injectedScripts.ts ← Before/after load JS (auth pre-hydration, history patch, \_\_handleNativeMessage)
│ ├── WebViewManager.ts ← Singleton ref registry
│ ├── WebViewContext.tsx ← Single global ref + shared state
│ └── WebViewContainer.tsx ← React.memo'd single WebView instance
├── components/
│ ├── Header/index.tsx ← Native top bar (brand + wallet balance)
│ ├── TabBar/index.tsx ← 5-tab native bar with cart badge + auth-guard
│ ├── LoadingScreen/index.tsx ← Overlay spinner while WebView loads
│ └── OfflineScreen/index.tsx ← Full-screen offline state + retry
├── screens/
│ ├── SplashScreen.tsx ← Brand splash during auth init
│ └── MainScreen.tsx ← WebView + Header + TabBar overlays
└── hooks/
├── useNetworkStatus.ts ← NetInfo wrapper
└── useWebViewRef.ts ← Access global WebView ref

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

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

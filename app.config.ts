import type { ExpoConfig } from "expo/config";

// The app's permanent ID on Google Play (chosen for 2.5.0). Never change it again: Android
// treats an app with another ID as a different app, with its own empty data.
// (Before 2.5.0 the ID was "space.manus.waris.genealogy.t20260312144942"; family data
// moves over with Backup in the old app, then Restore in this one.)
const APP_ID = "com.waris.salasilah";

// GitHub builds pass their run number, so every new APK installs as an update
const VERSION_CODE = 100 + (Number(process.env.BUILD_NUMBER) || 0);

const config: ExpoConfig = {
  name: "Waris",
  slug: "waris-genealogy",
  version: "2.5.0",
  // Tablets may rotate; phones are locked to portrait at start-up (app/_layout.tsx)
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: "waris",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: APP_ID,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSPhotoLibraryUsageDescription: "Allow Waris to use your photos for family member pictures",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#2E3F8F",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: APP_ID,
    versionCode: VERSION_CODE,
    permissions: [],
    // Not used by Waris: leave out so the Play listing shows only what the app needs
    blockedPermissions: ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.RECORD_AUDIO"],
    // "Open with Waris" for family files from WhatsApp, Files, Gmail ...
    intentFilters: [
      {
        action: "VIEW",
        category: ["DEFAULT"],
        // WhatsApp and Telegram often label .json files as generic binary or plain text,
        // so those types are accepted too; anything that isn't a Waris file is refused
        // politely on the Open screen
        data: [
          { scheme: "content", mimeType: "application/json" },
          { scheme: "content", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
          { scheme: "content", mimeType: "application/octet-stream" },
          { scheme: "content", mimeType: "text/plain" },
          { scheme: "content", mimeType: "text/json" },
          { scheme: "file", mimeType: "application/json" },
          { scheme: "file", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
          { scheme: "file", mimeType: "application/octet-stream" },
          { scheme: "file", mimeType: "text/plain" },
        ],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-sqlite",
    ["expo-document-picker", { iCloudContainerEnvironment: "Production" }],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Waris to use your photos for family member pictures",
        cameraPermission: "Allow Waris to take family member pictures",
        microphonePermission: false,
      },
    ],
    // "Share → Waris" for family files (backup .json, Excel .xlsx)
    [
      "expo-share-intent",
      {
        androidIntentFilters: ["application/json", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream", "text/json"],
        disableIOS: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#2E3F8F",
        dark: { backgroundColor: "#1D2752" },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 35,
        },
      },
    ],
  ],
  // Shown on the About page; set when the APK is built
  extra: { buildDate: new Date().toISOString().slice(0, 10) },
  experiments: {
    typedRoutes: false,
  },
};

export default config;

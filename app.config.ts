import type { ExpoConfig } from "expo/config";

// Keep this package id unchanged: Android only updates the installed app (and keeps
// its data for the one-time migration to SQLite) when the id stays the same.
const APP_ID = "space.manus.waris.genealogy.t20260312144942";

// GitHub builds pass their run number, so every new APK installs as an update
const VERSION_CODE = 100 + (Number(process.env.BUILD_NUMBER) || 0);

const config: ExpoConfig = {
  name: "Waris",
  slug: "waris-genealogy",
  version: "2.2.0",
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
      backgroundColor: "#FAFAF8",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: APP_ID,
    versionCode: VERSION_CODE,
    permissions: [],
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
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#000000" },
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
  experiments: {
    typedRoutes: false,
  },
};

export default config;

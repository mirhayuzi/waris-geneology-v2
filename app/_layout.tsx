import { router, Stack, useRootNavigationState } from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { useEffect } from "react";
import { setIncomingFile } from "@/lib/files";
import { StatusBar } from "expo-status-bar";
// Only the five weights the app uses (importing the whole family adds every style to the APK)
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { useFonts } from "expo-font";
import { ActivityIndicator, View } from "react-native";
import { Text } from "@/components/Text";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider, useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

/**
 * "Share → Waris" from WhatsApp, Telegram, Files ...: the shared family file goes to the
 * same Open screen as "Open with Waris". Shared text and links are ignored.
 */
function ShareListener() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const navReady = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (!hasShareIntent || !navReady) return;
    const file = shareIntent.files?.[0];
    if (file?.path) {
      setIncomingFile(file.path);
      router.push(`/open?t=${Date.now()}`);
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent, navReady]);
  return null;
}

function Gate() {
  const { ready, error } = useStore();
  const c = useColors();
  // The Waris font; if it fails to load, the phone's own font is used
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  if (!ready || error || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background, padding: 24 }}>
        {error ? <Text style={{ color: c.danger, textAlign: "center" }}>{error}</Text> : <ActivityIndicator color={c.primary} />}
      </View>
    );
  }
  return (
    <>
      <ShareListener />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="people" />
        <Stack.Screen name="person/[id]" />
        <Stack.Screen name="edit" options={{ presentation: "modal" }} />
        <Stack.Screen name="union" options={{ presentation: "modal" }} />
        <Stack.Screen name="relate" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="unlinked" />
        <Stack.Screen name="duplicates" />
        <Stack.Screen name="print" />
        <Stack.Screen name="open" />
        <Stack.Screen name="about" />
      <Stack.Screen name="chart" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Phones and tablets both turn sideways (following the phone's auto-rotate setting)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <ShareIntentProvider>
            <Gate />
          </ShareIntentProvider>
          <StatusBar style="auto" />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import * as ScreenOrientation from "expo-screen-orientation";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Dimensions, Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider, useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

function Gate() {
  const { ready, error } = useStore();
  const c = useColors();
  if (!ready || error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background, padding: 24 }}>
        {error ? <Text style={{ color: c.danger, textAlign: "center" }}>{error}</Text> : <ActivityIndicator color={c.primary} />}
      </View>
    );
  }
  return (
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
    </Stack>
  );
}

export default function RootLayout() {
  // Phones stay upright; tablets (shortest side 600dp or more) can turn
  useEffect(() => {
    if (Platform.OS === "web") return;
    const { width, height } = Dimensions.get("screen");
    if (Math.min(width, height) < 600) ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <Gate />
          <StatusBar style="auto" />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

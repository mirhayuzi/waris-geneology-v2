import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
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
    </Stack>
  );
}

export default function RootLayout() {
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

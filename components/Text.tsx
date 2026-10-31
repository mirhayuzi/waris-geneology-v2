import { forwardRef } from "react";
import { Text as RNText, StyleSheet, type TextProps } from "react-native";

/**
 * Text in the Waris font (Plus Jakarta Sans). Android picks a custom font's weight by
 * file, not by fontWeight, so the weight asked for is turned into the matching file.
 */
const BY_WEIGHT: Record<string, string> = {
  "100": "PlusJakartaSans_400Regular",
  "200": "PlusJakartaSans_400Regular",
  "300": "PlusJakartaSans_400Regular",
  "400": "PlusJakartaSans_400Regular",
  normal: "PlusJakartaSans_400Regular",
  "500": "PlusJakartaSans_500Medium",
  "600": "PlusJakartaSans_600SemiBold",
  "700": "PlusJakartaSans_700Bold",
  bold: "PlusJakartaSans_700Bold",
  "800": "PlusJakartaSans_800ExtraBold",
  "900": "PlusJakartaSans_800ExtraBold",
};

export const fontFor = (weight?: string | number) => BY_WEIGHT[String(weight ?? "400")] ?? BY_WEIGHT["400"];

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return <RNText ref={ref} style={style} {...rest} />;
  return <RNText ref={ref} {...rest} style={[style, { fontFamily: fontFor(flat.fontWeight), fontWeight: "normal" }]} />;
});

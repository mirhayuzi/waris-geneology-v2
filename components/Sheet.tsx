import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "@/components/Text";
import { useColors } from "@/lib/theme";
import { Icon, IconButton, type IconName, sheetStyle } from "./ui";

/** Bottom sheet with a dimmed backdrop. Close with ✕, or tap anywhere outside it. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const c = useColors();
  // A phone turned sideways is short: long sheets scroll instead of running off the screen
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent supportedOrientations={["portrait", "landscape"]}>
      <View style={styles.root}>
        {/* the whole dimmed area, beside the sheet too (wide screens), closes it */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[sheetStyle(c), { maxHeight: height * 0.88, paddingTop: 10 }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
              {title ?? ""}
            </Text>
            <IconButton icon="close" label="Close" color={c.muted} onPress={onClose} />
          </View>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function SheetItem({
  icon,
  label,
  onPress,
  disabled,
  color,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.item, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={24} color={color ?? c.primary} />
      <Text style={[styles.itemText, { color: color ?? c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginRight: -10, marginBottom: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: "600" },
  item: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 13 },
  itemText: { fontSize: 16 },
});

import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/lib/theme";
import { Icon, type IconName, sheetStyle } from "./ui";

/** Bottom sheet with a dimmed backdrop. Tap outside to close. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={sheetStyle(c)}>
        {title ? <Text style={[styles.title, { color: c.text }]}>{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
}

export function SheetItem({ icon, label, onPress, disabled, color }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.item, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={24} color={color ?? c.primary} />
      <Text style={[styles.itemText, { color: color ?? c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  title: { fontSize: 17, fontWeight: "600", marginBottom: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 13 },
  itemText: { fontSize: 16 },
});

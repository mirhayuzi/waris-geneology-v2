import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fullName, type Person } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";
import { Avatar } from "./Avatar";
import { IconButton } from "./ui";
import { lifespan } from "./TreeCard";

export function matches(p: Person, q: string): boolean {
  if (!q.trim()) return true;
  const hay = `${fullName(p)} ${p.nickname ?? ""} ${p.birthPlace ?? ""}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/** Searchable list of people, full-screen. */
export function PersonList({ people, onPick, autoFocus, header }: { people: Person[]; onPick: (p: Person) => void; autoFocus?: boolean; header?: React.ReactNode }) {
  const c = useColors();
  const { t } = useStore();
  const [q, setQ] = useState("");
  const list = useMemo(() => people.filter((p) => matches(p, q)).sort((a, b) => fullName(a).localeCompare(fullName(b))), [people, q]);
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchBox, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("search")}
          placeholderTextColor={c.muted}
          autoFocus={autoFocus}
          style={[styles.search, { color: c.text }]}
          clearButtonMode="while-editing"
        />
      </View>
      {header}
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={{ color: c.muted, textAlign: "center", marginTop: 32 }}>{t("noMatches")}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPick(item)} style={({ pressed }) => [styles.row, { borderBottomColor: c.border }, pressed && { backgroundColor: c.surfaceAlt }]}>
            <Avatar person={item} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 16 }} numberOfLines={1}>
                {fullName(item)}
              </Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{lifespan(item, t)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

export function PersonPicker({ visible, onClose, onPick, exclude = [], title }: { visible: boolean; onClose: () => void; onPick: (p: Person) => void; exclude?: string[]; title?: string }) {
  const c = useColors();
  const { graph, t } = useStore();
  const people = useMemo(() => graph.snapshot.persons.filter((p) => !exclude.includes(p.id)), [graph, exclude]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <IconButton icon="close" label={t("cancel")} onPress={onClose} />
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>{title ?? t("pickPerson")}</Text>
        </View>
        <PersonList
          people={people}
          autoFocus
          onPick={(p) => {
            onPick(p);
            onClose();
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: { margin: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  search: { height: 44, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});

import { router } from "expo-router";
import { useMemo } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { lifespan } from "@/components/TreeCard";
import { Button, Icon, Muted, Screen } from "@/components/ui";
import { duplicatePairs } from "@/lib/merge";
import { fullName, type Person } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

/** People who may have been entered twice; join them into one or mark them as different. */
export default function DuplicatesScreen() {
  const c = useColors();
  const store = useStore();
  const { graph, t } = store;
  const pairs = useMemo(() => duplicatePairs(graph, store.notDuplicates), [graph, store.notDuplicates]);

  const summary = (p: Person) => {
    const parts = [lifespan(p, t)];
    const parents = graph.parents(p.id).map((q) => q.givenName);
    if (parents.length) parts.push(parents.join(" & "));
    const partners = graph.partners(p.id).map((q) => `∞ ${q.givenName}`);
    parts.push(...partners);
    const kids = graph.childLinksOf(p.id).length;
    if (kids) parts.push(t("nChildren", { n: kids }));
    return parts.join(" · ");
  };

  const join = (keep: Person, drop: Person) =>
    Alert.alert(t("join"), t("joinQ", { keep: fullName(keep), drop: fullName(drop) }), [
      { text: t("cancel"), style: "cancel" },
      { text: t("join"), style: "destructive", onPress: () => store.joinPersons(keep.id, drop.id) },
    ]);

  const side = (p: Person, other: Person) => (
    <View style={[styles.side, { borderColor: c.border }]}>
      <Pressable onPress={() => router.push(`/person/${p.id}`)} style={{ alignItems: "center", gap: 6 }}>
        <Avatar person={p} size={52} />
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "600", textAlign: "center" }} numberOfLines={2}>
          {fullName(p)}
        </Text>
        <Muted style={{ textAlign: "center" }}>{summary(p)}</Muted>
      </Pressable>
      <Button title={t("keepThis")} kind="secondary" onPress={() => join(p, other)} style={{ marginTop: 10, height: 40 }} />
    </View>
  );

  return (
    <Screen title={t("duplicates")} back>
      <FlatList
        data={pairs}
        keyExtractor={([a, b]) => `${a.id}|${b.id}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        ListHeaderComponent={<Muted style={{ marginBottom: 12 }}>{t("duplicatesDesc")}</Muted>}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 40, gap: 8 }}>
            <Icon name="check-circle" size={48} color={c.primary} />
            <Muted>{t("noDuplicates")}</Muted>
          </View>
        }
        renderItem={({ item: [a, b] }) => (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {side(a, b)}
              {side(b, a)}
            </View>
            <Button title={t("notSame")} kind="plain" onPress={() => store.markNotDuplicate(a.id, b.id)} style={{ marginTop: 6 }} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12, padding: 12 },
  side: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10, justifyContent: "space-between" },
});

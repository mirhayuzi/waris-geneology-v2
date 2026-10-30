import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { lifespan } from "@/components/TreeCard";
import { Icon, Muted, Screen } from "@/components/ui";
import { RuleError } from "@/lib/actions";
import { yearOf } from "@/lib/dates";
import { unlinkedPeople } from "@/lib/match";
import { fullName, type Person } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

/** Everyone whose bin/binti matches a man in the tree but who isn't linked to him yet. */
export default function UnlinkedScreen() {
  const c = useColors();
  const store = useStore();
  const { graph, t } = store;
  const [busy, setBusy] = useState<string>();
  const list = useMemo(() => unlinkedPeople(graph), [graph]);

  const link = async (child: Person, father: Person) => {
    setBusy(child.id);
    try {
      const wives = graph.partners(father.id);
      const mother = graph.mother(child.id) ? undefined : wives.length === 1 ? wives[0].id : undefined;
      await store.linkParents(child.id, father.id, mother);
    } catch (e) {
      Alert.alert(t("needsLinking"), e instanceof RuleError ? t(e.key, e.vars) : String(e));
    } finally {
      setBusy(undefined);
    }
  };

  const fatherInfo = (f: Person) => {
    const parts = [yearOf(f.birthDate), ...graph.partners(f.id).map((w) => `∞ ${w.givenName}`)].filter(Boolean);
    const kids = graph.childLinksOf(f.id).length;
    if (kids) parts.push(t("nChildren", { n: kids }));
    return parts.join(" · ");
  };

  return (
    <Screen title={t("needsLinking")} back>
      <FlatList
        data={list}
        keyExtractor={(x) => x.person.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        ListHeaderComponent={<Muted style={{ marginBottom: 12 }}>{t("needsLinkingDesc")}</Muted>}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 40, gap: 8 }}>
            <Icon name="check-circle" size={48} color={c.primary} />
            <Muted>{t("nothingToLink")}</Muted>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, opacity: busy === item.person.id ? 0.5 : 1 }]}>
            <Pressable onPress={() => router.push(`/person/${item.person.id}`)} style={styles.head}>
              <Avatar person={item.person} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{fullName(item.person)}</Text>
                <Muted>{lifespan(item.person, t)}</Muted>
              </View>
            </Pressable>
            {item.candidates.map((f) => (
              <Pressable
                key={f.id}
                disabled={!!busy}
                onPress={() => link(item.person, f)}
                style={({ pressed }) => [styles.option, { borderTopColor: c.border }, pressed && { backgroundColor: c.surfaceAlt }]}
              >
                <Icon name="add-link" size={22} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.primary, fontSize: 15, fontWeight: "600" }}>{t("linkTo", { name: fullName(f) })}</Text>
                  {fatherInfo(f) ? <Muted>{fatherInfo(f)}</Muted> : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});

import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { PersonPicker } from "@/components/PersonPicker";
import { Icon, Muted, Screen, Section } from "@/components/ui";
import { relationships } from "@/lib/kinship";
import { fullName, type Person } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

/** Pick two people and see how they are related, in Malay and English. */
export default function RelateScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const { graph, t, homeId } = useStore();
  const [aId, setA] = useState(params.a ?? homeId);
  const [bId, setB] = useState(params.b);
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const a = graph.get(aId);
  const b = graph.get(bId);
  const both = a && b ? { ab: relationships(graph, a.id, b.id), ba: relationships(graph, b.id, a.id) } : null;

  const slot = (label: string, p: Person | undefined, which: "a" | "b") => (
    <Pressable onPress={() => setPicking(which)} style={[styles.slot, { backgroundColor: c.surface, borderColor: c.border }]}>
      {p ? <Avatar person={p} size={48} /> : <Icon name="person-search" size={40} color={c.primary} />}
      <View style={{ flex: 1 }}>
        <Muted>{label}</Muted>
        <Text style={{ color: c.text, fontSize: 16 }} numberOfLines={2}>
          {p ? fullName(p) : t("pickPerson")}
        </Text>
      </View>
      <Icon name="chevron-right" color={c.muted} />
    </Pressable>
  );

  const sentence = (x: Person, y: Person, list: { en: string; bm: string }[]) => (
    <View style={{ padding: 14 }}>
      <Text style={{ color: c.text, fontSize: 16, lineHeight: 23 }}>
        <Text style={{ fontWeight: "700" }}>{y.givenName}</Text>
        {" → "}
        {list.length ? list.map((k) => k.bm).join(" · ") : "—"}
      </Text>
      <Muted>
        {y.givenName} is {x.givenName}&apos;s {list.length ? list.map((k) => k.en).join(" · ") : "—"}
      </Muted>
    </View>
  );

  return (
    <Screen title={t("relationship")} back>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {slot(t("personA"), a, "a")}
        {slot(t("personB"), b, "b")}
        {a && b && both ? (
          both.ab.length || both.ba.length ? (
            <Section title={t("relationship")}>
              {sentence(a, b, both.ab)}
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
              {sentence(b, a, both.ba)}
            </Section>
          ) : (
            <Muted style={{ marginTop: 20, textAlign: "center" }}>{t("notRelated")}</Muted>
          )
        ) : null}
      </ScrollView>
      <PersonPicker
        visible={picking !== null}
        onClose={() => setPicking(null)}
        onPick={(p) => (picking === "a" ? setA(p.id) : setB(p.id))}
        exclude={[picking === "a" ? bId : aId].filter(Boolean) as string[]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  slot: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
});

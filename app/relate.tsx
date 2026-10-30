import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { PersonPicker } from "@/components/PersonPicker";
import { relationLines } from "@/components/relation";
import { Sheet } from "@/components/Sheet";
import { Button, Field, Icon, IconButton, Muted, Screen, Section } from "@/components/ui";
import { connectionPath, describePath, relationText, type RelationText } from "@/lib/kinship";
import { fullName, type Person } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

/** Pick two people and see how they are related, how they connect, and how each is related to you. */
export default function RelateScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const { graph, t, lang, homeId, customTerms, setCustomTerm } = useStore();
  const [aId, setA] = useState(params.a ?? homeId);
  const [bId, setB] = useState(params.b);
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const [editing, setEditing] = useState<{ key: string; example: string; value: string } | null>(null);
  const a = graph.get(aId);
  const b = graph.get(bId);
  const home = graph.get(homeId);

  const result = useMemo(() => {
    if (!a || !b || a.id === b.id) return null;
    const path = connectionPath(graph, a.id, b.id);
    return {
      ab: relationText(graph, a.id, b.id, customTerms),
      ba: relationText(graph, b.id, a.id, customTerms),
      steps: path ? describePath(graph, path) : [],
    };
  }, [graph, a, b, customTerms]);

  const toHome = (x: Person) => (home && home.id !== x.id ? relationText(graph, home.id, x.id, customTerms) : null);

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

  /** "B → term" for one direction, with a pencil to set the user's own word when there is no single term. */
  const sentence = (x: Person, y: Person, r: RelationText | null, last?: boolean) => {
    const lines = r ? relationLines(r, lang, t) : null;
    return (
      <View style={[styles.sentence, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 16, lineHeight: 23 }}>
            <Text style={{ fontWeight: "700" }}>{y.givenName}</Text>
            {" → "}
            <Text style={{ color: c.primary, fontWeight: "600" }}>{lines?.main ?? "—"}</Text>
          </Text>
          {lines?.sub ? <Muted>{lines.sub}</Muted> : null}
          <Muted style={{ marginTop: 2 }}>
            {lang === "bm" ? `kepada ${x.givenName}` : `to ${x.givenName}`}
          </Muted>
        </View>
        {r?.via ? (
          <IconButton
            icon="edit"
            size={20}
            color={c.muted}
            label={t("setMyTerm")}
            onPress={() => setEditing({ key: r.via!.key, example: lang === "bm" ? r.via!.bm : r.via!.en, value: r.custom ?? "" })}
          />
        ) : null}
      </View>
    );
  };

  const homeLine = (x: Person) => {
    const r = toHome(x);
    const lines = r ? relationLines(r, lang, t) : null;
    return (
      <View key={x.id} style={styles.homeRow}>
        <Avatar person={x} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 15 }} numberOfLines={1}>
            {x.givenName}
          </Text>
          <Text style={{ color: c.primary, fontSize: 14, fontWeight: "600" }}>{lines?.main ?? t("notRelated")}</Text>
          {lines?.sub ? <Muted>{lines.sub}</Muted> : null}
        </View>
      </View>
    );
  };

  const connected = result && (result.ab || result.ba || result.steps.length);

  return (
    <Screen title={t("relationship")} back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {slot(t("personA"), a, "a")}
        {slot(t("personB"), b, "b")}

        {a && b && result ? (
          connected ? (
            <>
              <Section title={t("between")}>
                {sentence(a, b, result.ab)}
                {sentence(b, a, result.ba, true)}
              </Section>

              {result.steps.length > 1 ? (
                <Section title={t("pathTitle")}>
                  <View style={{ padding: 14 }}>
                    <PathNode person={a} note={undefined} onPress={() => router.push(`/person/${a.id}`)} />
                    {result.steps.map((s, i) => {
                      const hr = toHome(s.to);
                      const note = hr && s.to.id !== home?.id ? relationLines(hr, lang, t).main : s.to.id === home?.id ? t("isHome") : undefined;
                      return (
                        <View key={i}>
                          <View style={styles.arrow}>
                            <View style={[styles.line, { backgroundColor: c.border }]} />
                            <Text style={{ color: c.muted, fontSize: 13 }}>
                              {lang === "bm" ? `${s.kin.bm} kepada ${s.from.givenName}` : `${s.from.givenName}'s ${s.kin.en}`}
                            </Text>
                          </View>
                          <PathNode person={s.to} note={note} onPress={() => router.push(`/person/${s.to.id}`)} />
                        </View>
                      );
                    })}
                  </View>
                </Section>
              ) : null}

              {home && home.id !== a.id && home.id !== b.id ? (
                <Section title={t("toYou", { name: home.givenName })}>
                  <View style={{ paddingHorizontal: 14 }}>
                    {homeLine(a)}
                    {homeLine(b)}
                  </View>
                </Section>
              ) : null}
            </>
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

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={t("setMyTerm")}>
        {editing ? (
          <>
            <Muted style={{ marginBottom: 10 }}>{editing.example}</Muted>
            <Field
              label={t("myTerm")}
              value={editing.value}
              onChangeText={(value) => setEditing({ ...editing, value })}
              hint={t("myTermHint")}
              autoFocus
              autoCapitalize="none"
            />
            <Button
              title={t("save")}
              onPress={async () => {
                await setCustomTerm(editing.key, editing.value);
                setEditing(null);
              }}
            />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function PathNode({ person, note, onPress }: { person: Person; note?: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.node, pressed && { opacity: 0.6 }]}>
      <Avatar person={person} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
          {fullName(person)}
        </Text>
        {note ? <Text style={{ color: c.primary, fontSize: 13 }}>{note}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
  sentence: { flexDirection: "row", alignItems: "center", padding: 14, gap: 8 },
  node: { flexDirection: "row", alignItems: "center", gap: 12 },
  arrow: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 19, paddingVertical: 4 },
  line: { width: 2, height: 26, marginRight: 9 },
  homeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
});

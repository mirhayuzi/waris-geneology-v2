import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { PersonPicker } from "@/components/PersonPicker";
import { Portrait } from "@/components/Portrait";
import { relationLines } from "@/components/relation";
import { Sheet } from "@/components/Sheet";
import { Text } from "@/components/Text";
import { lifespan } from "@/components/TreeCard";
import { Button, Field, Icon, IconButton, Muted, Screen, Section } from "@/components/ui";
import { connectionPath, describePath, type Kin, relationships, relationSummary, relationText, type RelationText } from "@/lib/kinship";
import { cardName, fullName, type Person } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Pick two people and see how they are related: both side by side (like a phone-compare page),
 * the answer in one sentence, where their lines meet, details, and the other way round.
 */
export default function RelateScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const store = useStore();
  const { graph, t, lang, homeId, customTerms, setCustomTerm } = store;
  const [aId, setA] = useState(params.a ?? homeId);
  const [bId, setB] = useState(params.b);
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const [editing, setEditing] = useState<{ key: string; example: string; value: string } | null>(null);
  const a = graph.get(aId);
  const b = graph.get(bId);
  const home = graph.get(homeId);
  const term = (k: Kin) => (lang === "bm" ? k.bm : k.en);
  const otherTerm = (k: Kin) => (lang === "bm" ? k.en : k.bm);

  const result = useMemo(() => {
    if (!a || !b || a.id === b.id) return null;
    const summary = relationSummary(graph, a.id, b.id);
    // A path is only needed when they are linked by marriage, not by blood
    const path = summary.blood ? null : connectionPath(graph, a.id, b.id);
    const via = summary.via;
    return {
      ab: relationText(graph, a.id, b.id, customTerms),
      ba: relationText(graph, b.id, a.id, customTerms),
      summary,
      viaToB: via ? relationships(graph, via.person.id, b.id)[0] : undefined,
      steps: path ? describePath(graph, path) : [],
    };
  }, [graph, a, b, customTerms]);

  const toHome = (x: Person) => (home && home.id !== x.id ? relationText(graph, home.id, x.id, customTerms) : null);
  const open = (p: Person) => router.push(`/person/${p.id}`);

  /** What `x` is to `y`, as a short badge: "Pakcik", "Anak saudara", "Ibu" */
  const badge = (r: RelationText | null | undefined): string | undefined => {
    if (!r) return undefined;
    const k = r.direct[0];
    if (k) return cap(lang === "bm" ? (k.call ?? k.bm) : k.en);
    return r.custom ? cap(r.custom) : undefined;
  };

  /** One of the two people: a big upright photo first, like a phone-compare page */
  const personCard = (label: string, p: Person | undefined, which: "a" | "b", rel?: string, warm?: boolean) => (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Pressable onPress={() => (p ? open(p) : setPicking(which))} accessibilityRole="button" accessibilityLabel={p ? fullName(p) : t("pickPerson")}>
        {p ? (
          <Portrait person={p} height={232} />
        ) : (
          <View style={[styles.emptyPhoto, { backgroundColor: c.surfaceAlt }]}>
            <Icon name="person-search" size={56} color={c.primary} />
          </View>
        )}
      </Pressable>
      <Pressable onPress={() => setPicking(which)} style={[styles.change, { backgroundColor: c.surface }]} accessibilityRole="button" accessibilityLabel={`${t("changePerson")}: ${label}`}>
        <Text style={{ color: c.primary, fontSize: 12, fontWeight: "700" }}>{t("changePerson")}</Text>
      </Pressable>
      <View style={[styles.genderBar, { backgroundColor: p ? (p.sex === "female" ? c.female : c.male) : c.border }]} />
      <View style={styles.cardBody}>
        {rel ? (
          <View style={[styles.badge, { backgroundColor: warm ? `${c.focusRing}33` : c.surfaceAlt }]}>
            <Text style={{ color: warm ? c.text : c.primary, fontSize: 12, fontWeight: "700", textAlign: "center" }} numberOfLines={2}>
              {rel}
            </Text>
          </View>
        ) : (
          <Text style={[styles.cardLabel, { color: c.muted }]}>{label}</Text>
        )}
        {p ? (
          <>
            <Text style={[styles.cardName, { color: c.text }]} numberOfLines={2}>
              {cardName(p)[0]}
            </Text>
            {cardName(p)[1] ? (
              <Text style={{ color: c.muted, textAlign: "center", fontSize: 13 }} numberOfLines={2}>
                {cardName(p)[1]}
              </Text>
            ) : null}
            <Text style={{ color: c.muted, textAlign: "center", fontSize: 13 }}>{lifespan(p, t)}</Text>
          </>
        ) : (
          <Text style={[styles.cardName, { color: c.text }]}>{t("pickPerson")}</Text>
        )}
      </View>
    </View>
  );

  /** "Alai ialah pakcik kepada Umar" */
  const headline = (x: Person, y: Person, r: RelationText | null): string | null => {
    if (!r) return null;
    if (r.direct.length) {
      const words = r.direct.map((k) => (lang === "bm" ? (k.call ?? k.bm) : k.en)).join(" · ");
      return t("relSentence", { a: x.givenName, b: y.givenName, rel: words });
    }
    if (r.custom) return t("relSentence", { a: x.givenName, b: y.givenName, rel: r.custom });
    return t("relViaSentence", { b: y.givenName, rel: lang === "bm" ? r.via!.bm : r.via!.en });
  };

  const row = (label: string, value: string, last?: boolean) => (
    <View key={label} style={[styles.row, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.rowLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: c.text }]}>{value}</Text>
    </View>
  );

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
  const s = result?.summary;
  const main = result?.ab?.direct[0];
  const side = s?.side ? cap(t(s.side === "father" ? "sideFather" : "sideMother")) : undefined;
  const genUp = (n: number) => (n === 1 ? t("genUp1") : t("genUpN", { n }));
  // One shared ancestor to show: the husband when they share a couple
  const anc = s ? (s.common.find((p) => p.sex === "male") ?? s.common[0]) : undefined;
  const ancPartner = s && anc ? s.common.find((p) => p.id !== anc.id) : undefined;

  return (
    <Screen title={t("relationship")} back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* The two people, side by side */}
        <View style={styles.pair}>
          {personCard(t("personA"), a, "a", badge(result?.ba))}
          <View style={{ width: 12 }} />
          {personCard(t("personB"), b, "b", badge(result?.ab), true)}
          {a && b ? (
            <Pressable
              onPress={() => {
                setA(b.id);
                setB(a.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("swapPeople")}
              style={[styles.swap, { backgroundColor: c.primary, borderColor: c.background }]}
            >
              <Icon name="swap-horiz" size={24} color={c.primaryText} />
            </Pressable>
          ) : null}
        </View>

        {a && b && result && s ? (
          connected ? (
            <>
              {/* The answer */}
              <View style={[styles.hero, { backgroundColor: c.primary }]}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={[styles.heroKicker, { color: c.focusRing }]}>{t("relHeading").toUpperCase()}</Text>
                    <Text style={[styles.heroTitle, { color: c.primaryText }]}>{headline(a, b, result.ab)}</Text>
                  </View>
                  {result.ab?.via ? (
                    <IconButton
                      icon="edit"
                      size={20}
                      color={c.primaryText}
                      label={t("setMyTerm")}
                      onPress={() => setEditing({ key: result.ab!.via!.key, example: lang === "bm" ? result.ab!.via!.bm : result.ab!.via!.en, value: result.ab!.custom ?? "" })}
                    />
                  ) : null}
                </View>
                {s.via && result.viaToB ? (
                  <Text style={[styles.heroText, { color: c.primaryText }]}>
                    {t("relExplain", { b: b.givenName, via: s.via.person.givenName, a: a.givenName, rel: term(result.viaToB), viaRel: term(s.via.toA) })}
                  </Text>
                ) : null}
                {main?.call && lang === "en" ? (
                  <Text style={[styles.heroText, { color: c.primaryText }]}>{t("relCalls", { a: a.givenName, b: b.givenName, call: main.call })}</Text>
                ) : null}
                <View style={styles.chips}>
                  {side ? <Chip text={side} /> : null}
                  <Chip text={s.blood ? t("typeBlood") : t("typeMarriage")} />
                </View>
              </View>

              {/* Where their lines meet: one shared ancestor (the husband of a couple), however far up */}
              {s.blood && s.blood.up > 0 && s.blood.down > 0 && anc && s.commonToA && s.commonToB ? (
                <Section title={t("meetAt")}>
                  <View style={styles.meet}>
                    <Text style={[styles.meetKicker, { color: c.focusRing }]}>{t("sharedAncestor").toUpperCase()}</Text>
                    <Pressable onPress={() => open(anc)} accessibilityRole="button" accessibilityLabel={fullName(anc)} style={styles.meetPhoto}>
                      <Portrait person={anc} height={210} radius={16} />
                      <View style={[styles.genderBar, { backgroundColor: anc.sex === "female" ? c.female : c.male }]} />
                    </Pressable>
                    <Text style={[styles.meetName, { color: c.text }]}>{[anc.prefix, cardName(anc)[0]].filter(Boolean).join(" ")}</Text>
                    {cardName(anc)[1] ? <Muted>{cardName(anc)[1]}</Muted> : null}
                    {ancPartner ? (
                      <Muted style={{ textAlign: "center" }}>
                        {t(anc.sex === "female" ? "withHusband" : "withWife", { name: [ancPartner.prefix, ancPartner.givenName].filter(Boolean).join(" ") })}
                      </Muted>
                    ) : null}
                    <View style={styles.meetBoxes}>
                      {[
                        { who: a, kin: s.commonToA, n: s.blood.up },
                        { who: b, kin: s.commonToB, n: s.blood.down },
                      ].map(({ who, kin, n }) => (
                        <View key={who.id} style={[styles.meetBox, { backgroundColor: c.surfaceAlt }]}>
                          <Text style={{ color: c.text, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                            {who.givenName}
                          </Text>
                          <Text style={{ color: c.primary, fontSize: 16, fontWeight: "800" }}>{cap(term(kin).replace(/ (lelaki|perempuan)$/, ""))}</Text>
                          <View style={styles.dots} accessibilityLabel={genUp(n)}>
                            {Array.from({ length: Math.min(n, 6) }, (_, i) => (
                              <View key={i} style={[styles.dot, { backgroundColor: c.primary }]} />
                            ))}
                            {n > 6 ? <Text style={{ color: c.primary, fontSize: 12, fontWeight: "700" }}>+{n - 6}</Text> : null}
                          </View>
                          <Muted style={{ fontSize: 12 }}>{genUp(n)}</Muted>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      onPress={() => {
                        store.setFocus(anc.id);
                        router.dismissTo("/");
                      }}
                      style={styles.treeLink}
                      accessibilityRole="button"
                    >
                      <Text style={{ color: c.primary, fontSize: 14, fontWeight: "600" }}>{t("viewInTree")}</Text>
                      <Icon name="chevron-right" size={20} color={c.primary} />
                    </Pressable>
                  </View>
                </Section>
              ) : null}

              {/* Linked by marriage: the short chain of people */}
              {!s.blood && result.steps.length > 1 ? (
                <Section title={t("pathTitle")}>
                  <View style={{ padding: 14 }}>
                    <PathNode person={a} onPress={() => open(a)} />
                    {result.steps.map((st, i) => (
                      <View key={i}>
                        <View style={styles.arrow}>
                          <View style={[styles.line, { backgroundColor: c.border }]} />
                          <Text style={{ color: c.muted, fontSize: 13, flex: 1 }}>
                            {lang === "bm" ? `${st.kin.bm} kepada ${st.from.givenName}` : `${st.from.givenName}'s ${st.kin.en}`}
                          </Text>
                        </View>
                        <PathNode person={st.to} onPress={() => open(st.to)} />
                      </View>
                    ))}
                  </View>
                </Section>
              ) : null}

              {/* Details, like a spec table */}
              {result.ab ? (
                <Section title={t("relDetails")}>
                  {row(
                    t("rowRelation"),
                    result.ab.direct.length
                      ? result.ab.direct.map((k) => (lang === "bm" && k.call ? `${cap(k.bm)} (${k.call})` : cap(term(k)))).join(" · ")
                      : cap(result.ab.custom ?? relationLines(result.ab, lang, t).main),
                  )}
                  {side ? row(t("rowSide"), side) : null}
                  {row(t("rowType"), s.blood ? t("typeBlood") : t("typeMarriage"), !main)}
                  {main ? row(t("otherLang"), cap(result.ab.direct.map(otherTerm).join(" · ")), true) : null}
                </Section>
              ) : null}

              {/* The other way round */}
              {result.ba ? (
                <Section title={t("otherWay")}>
                  <View style={styles.reverse}>
                    <View style={styles.thumb}>
                      <Portrait person={a} height={60} radius={10} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{headline(b, a, result.ba)}</Text>
                      <Muted>{relationLines(result.ba, lang, t).sub}</Muted>
                    </View>
                    {result.ba.via ? (
                      <IconButton
                        icon="edit"
                        size={20}
                        color={c.muted}
                        label={t("setMyTerm")}
                        onPress={() => setEditing({ key: result.ba!.via!.key, example: lang === "bm" ? result.ba!.via!.bm : result.ba!.via!.en, value: result.ba!.custom ?? "" })}
                      />
                    ) : null}
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

function Chip({ text, italic }: { text: string; italic?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.chip, { backgroundColor: "rgba(255,255,255,0.16)" }]}>
      <Text style={{ color: c.primaryText, fontSize: 13, fontWeight: "600", fontStyle: italic ? "italic" : "normal" }}>{text}</Text>
    </View>
  );
}

function PathNode({ person, onPress }: { person: Person; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.node, pressed && { opacity: 0.6 }]}>
      <Avatar person={person} size={40} />
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "600", flex: 1 }} numberOfLines={1}>
        {fullName(person)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", alignItems: "stretch" },
  card: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  emptyPhoto: { height: 232, alignItems: "center", justifyContent: "center" },
  change: { position: "absolute", top: 10, right: 10, minHeight: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center" },
  genderBar: { height: 5, alignSelf: "stretch" },
  cardBody: { paddingTop: 12, paddingBottom: 14, paddingHorizontal: 10, alignItems: "center", gap: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 4, maxWidth: "100%" },
  cardLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", textAlign: "center", marginBottom: 4 },
  cardName: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  swap: { position: "absolute", left: "50%", top: 92, marginLeft: -25, width: 50, height: 50, borderRadius: 25, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  hero: { marginTop: 16, borderRadius: 20, padding: 20, gap: 10 },
  heroKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
  heroTitle: { fontSize: 24, fontWeight: "800", lineHeight: 31 },
  heroText: { fontSize: 15, lineHeight: 22, opacity: 0.9 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  meet: { alignItems: "center", padding: 16, gap: 4 },
  meetKicker: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  meetPhoto: { width: 170, borderRadius: 16, overflow: "hidden" },
  meetName: { fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 8 },
  meetBoxes: { flexDirection: "row", gap: 10, marginTop: 14, alignSelf: "stretch" },
  meetBox: { flex: 1, borderRadius: 14, padding: 12, gap: 4 },
  dots: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  treeLink: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44, paddingHorizontal: 12, marginTop: 6 },
  row: { flexDirection: "row", paddingVertical: 13, paddingHorizontal: 16, gap: 12 },
  rowLabel: { width: 110, fontSize: 14 },
  rowValue: { flex: 1, fontSize: 14, fontWeight: "600" },
  reverse: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  thumb: { width: 48 },
  node: { flexDirection: "row", alignItems: "center", gap: 12 },
  arrow: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 19, paddingVertical: 4 },
  line: { width: 2, height: 26, marginRight: 9 },
  homeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
});

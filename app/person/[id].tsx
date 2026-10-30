import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { relationLines } from "@/components/relation";
import { lifespan } from "@/components/TreeCard";
import { Button, Icon, IconButton, Muted, Row, Screen, Section } from "@/components/ui";
import { ageAt, formatDate } from "@/lib/dates";
import { relationText } from "@/lib/kinship";
import { fullName, type Person } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

export default function ProfileScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const { graph, t, lang, homeId, customTerms } = store;
  const p = graph.get(id);
  const [allKinds, setAllKinds] = useState(false);
  const [openGen, setOpenGen] = useState<number>();
  if (!p) {
    return (
      <Screen title="" back>
        <Muted style={{ margin: 24 }}>{t("noMatches")}</Muted>
      </Screen>
    );
  }

  const home = graph.get(homeId);
  const rel = home && home.id !== p.id ? relationText(graph, home.id, p.id, customTerms) : null;
  const relLines = rel ? relationLines(rel, lang, t) : null;

  // Descendants: anak, cucu, cicit, piut ...
  const gens = graph.descendantsByGeneration(p.id, { includeNonBirth: allKinds });
  const genNames = t("genNames").split(",");
  const genName = (i: number) => genNames[i] ?? t("genN", { n: i + 1 });
  const totalDesc = gens.reduce((n, g) => n + g.length, 0);

  const parentLinks = graph.parentLinksOf(p.id);
  const unions = graph.unions(p.id);
  const siblings = graph.siblings(p.id);
  const children = graph.children(p.id);

  const age = p.living ? ageAt(p.birthDate) : ageAt(p.birthDate, p.deathDate);
  const facts: [string, string][] = [];
  if (p.birthDate || p.birthPlace) facts.push([t("birth"), [formatDate(p.birthDate, lang), p.birthPlace].filter(Boolean).join(" · ")]);
  if (!p.living) facts.push([t("death"), [formatDate(p.deathDate, lang), p.deathPlace].filter(Boolean).join(" · ") || t("deceased")]);
  if (p.burialPlace) facts.push([t("burialPlace"), p.burialPlace]);
  if (p.religion) facts.push([t("religion"), p.religion]);
  if (p.ethnicity) facts.push([t("ethnicity"), p.ethnicity]);
  if (p.occupation) facts.push([t("occupation"), p.occupation]);
  if (p.phone) facts.push([t("phone"), p.phone]);

  const confirmUnlink = (other: Person, run: () => Promise<void>) =>
    Alert.alert(t("removeLink"), t("removeLinkQ", { a: p.givenName, b: other.givenName }), [
      { text: t("cancel"), style: "cancel" },
      { text: t("remove"), style: "destructive", onPress: () => run() },
    ]);

  const personRow = (q: Person, sub: string, onLong?: () => void, last?: boolean) => (
    <Row
      key={q.id + sub}
      title={fullName(q)}
      subtitle={sub}
      left={<Avatar person={q} size={40} />}
      onPress={() => router.push(`/person/${q.id}`)}
      onLongPress={onLong}
      last={last}
    />
  );

  const addBtn = (role: string) => <IconButton icon="add" label={t("add")} size={22} color={c.primary} onPress={() => router.push({ pathname: "/edit", params: { role, of: p.id } })} />;

  const onDelete = () =>
    Alert.alert(t("delete"), t("deletePersonQ", { name: fullName(p) }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          await store.deletePerson(p.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen title={p.givenName} back right={<IconButton icon="edit" label={t("edit")} onPress={() => router.push({ pathname: "/edit", params: { id: p.id } })} />}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={styles.top}>
          <Avatar person={p} size={104} />
          <Text style={[styles.name, { color: c.text }]}>{fullName(p)}</Text>
          {p.nickname ? <Muted>“{p.nickname}”</Muted> : null}
          <Muted style={{ marginTop: 4 }}>
            {lifespan(p, t)}
            {age !== undefined ? ` · ${p.living ? t("age", { n: age }) : t("ageAtDeath", { n: age })}` : ""}
          </Muted>
          {home && home.id === p.id ? (
            <View style={[styles.badge, { backgroundColor: c.primary }]}>
              <Icon name="home" size={14} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{t("isHome")}</Text>
            </View>
          ) : null}
          {relLines ? (
            <>
              <Text style={[styles.kin, { color: c.primary }]}>
                {t("relationToHome", { name: home!.givenName })}: {relLines.main}
              </Text>
              {relLines.sub ? <Muted style={{ textAlign: "center" }}>{relLines.sub}</Muted> : null}
            </>
          ) : home && home.id !== p.id ? (
            <Muted style={{ marginTop: 8 }}>{t("notRelated")}</Muted>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button
            title={t("viewInTree")}
            icon="account-tree"
            onPress={() => {
              store.setFocus(p.id);
              router.dismissTo("/");
            }}
            style={{ flex: 1 }}
          />
        </View>

        {facts.length ? (
          <Section>
            {facts.map(([k, v], i) => (
              <Row key={k} title={v} subtitle={k} last={i === facts.length - 1} />
            ))}
          </Section>
        ) : null}

        {totalDesc || graph.childLinksOf(p.id).length ? (
          <Section title={t("descendants")}>
            <View style={styles.genRow}>
              {gens.map((g, i) => {
                const on = openGen === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setOpenGen(on ? undefined : i)}
                    style={[styles.genChip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }]}
                  >
                    <Text style={[styles.genNum, { color: on ? c.primaryText : c.text }]}>{g.length}</Text>
                    <Text style={{ color: on ? c.primaryText : c.muted, fontSize: 12 }}>{genName(i)}</Text>
                  </Pressable>
                );
              })}
              <View style={[styles.genChip, { borderColor: "transparent" }]}>
                <Text style={[styles.genNum, { color: c.primary }]}>{totalDesc}</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>{t("total")}</Text>
              </View>
            </View>
            {openGen !== undefined && gens[openGen]
              ? gens[openGen].map((q) => personRow(q, lifespan(q, t)))
              : null}
            <View style={[styles.optRow, { borderTopColor: c.border }]}>
              <Text style={{ color: c.muted, fontSize: 13, flex: 1 }}>{t("includeNonBirth")}</Text>
              <Switch value={allKinds} onValueChange={setAllKinds} trackColor={{ true: c.primary }} />
            </View>
          </Section>
        ) : null}

        <Section title={t("parents")} right={parentLinks.length < 2 ? addBtn(graph.father(p.id) ? "mother" : "father") : undefined}>
          {parentLinks.length ? (
            parentLinks.map((l, i) => {
              const q = graph.get(l.parentId)!;
              const label = (q.sex === "male" ? t("father") : t("mother")) + (l.kind !== "birth" ? ` · ${t(`kind_${l.kind}`)}` : "");
              return personRow(q, label, () => confirmUnlink(q, () => store.removeParentLink(l.id)), i === parentLinks.length - 1);
            })
          ) : (
            <Row title={t("addFather")} left={<Icon name="add" color={c.primary} />} onPress={() => router.push({ pathname: "/edit", params: { role: "father", of: p.id } })} last />
          )}
        </Section>

        <Section title={t("spouses")} right={addBtn("spouse")}>
          {unions.length ? (
            unions.map((u, i) => {
              const q = graph.partnerOf(u, p.id);
              const sub = [t(`status_${u.status}`), formatDate(u.startDate, lang)].filter(Boolean).join(" · ");
              return (
                <Row
                  key={u.id}
                  title={fullName(q)}
                  subtitle={sub}
                  left={<Avatar person={q} size={40} />}
                  onPress={() => router.push(`/person/${q.id}`)}
                  onLongPress={() => router.push({ pathname: "/union", params: { id: u.id } })}
                  right={<IconButton icon="edit-note" label={t("editMarriage")} color={c.muted} onPress={() => router.push({ pathname: "/union", params: { id: u.id } })} />}
                  last={i === unions.length - 1}
                />
              );
            })
          ) : (
            <Row title={t("addSpouse")} left={<Icon name="add" color={c.primary} />} onPress={() => router.push({ pathname: "/edit", params: { role: "spouse", of: p.id } })} last />
          )}
        </Section>

        <Section title={`${t("children")}${children.length ? ` (${children.length})` : ""}`} right={addBtn("child")}>
          {children.length ? (
            children.map((q, i) => {
              const link = graph.childLinksOf(p.id).find((l) => l.childId === q.id)!;
              const sub = lifespan(q, t) + (link.kind !== "birth" ? ` · ${t(`kind_${link.kind}`)}` : "");
              return personRow(q, sub, () => confirmUnlink(q, () => store.removeParentLink(link.id)), i === children.length - 1);
            })
          ) : (
            <Row title={t("addChild")} left={<Icon name="add" color={c.primary} />} onPress={() => router.push({ pathname: "/edit", params: { role: "child", of: p.id } })} last />
          )}
        </Section>

        {siblings.length || parentLinks.length ? (
          <Section title={t("siblings")} right={parentLinks.length ? addBtn("sibling") : undefined}>
            {siblings.length ? (
              siblings.map((s, i) => personRow(s.person, lifespan(s.person, t) + (s.half ? ` · ${t("half")}` : ""), undefined, i === siblings.length - 1))
            ) : (
              <Row title={t("addSibling")} left={<Icon name="add" color={c.primary} />} onPress={() => router.push({ pathname: "/edit", params: { role: "sibling", of: p.id } })} last />
            )}
          </Section>
        ) : null}

        {p.notes ? (
          <Section title={t("notes")}>
            <Text style={{ color: c.text, padding: 14, fontSize: 15, lineHeight: 21 }}>{p.notes}</Text>
          </Section>
        ) : null}

        <Section>
          <Row title={t("findRelationship")} left={<Icon name="device-hub" color={c.primary} />} onPress={() => router.push({ pathname: "/relate", params: { a: p.id } })} />
          {homeId !== p.id ? <Row title={t("setHome")} left={<Icon name="home" color={c.primary} />} onPress={() => store.setHome(p.id)} /> : null}
          <Row title={t("delete")} left={<Icon name="delete-outline" color={c.danger} />} onPress={onDelete} last />
        </Section>
        <Muted style={{ marginTop: 12, textAlign: "center" }}>{t("longPressHint")}</Muted>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: "center", paddingVertical: 8 },
  name: { fontSize: 22, fontWeight: "700", marginTop: 12, textAlign: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  kin: { marginTop: 10, fontSize: 15, fontWeight: "600", textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  genRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  genChip: { minWidth: 64, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  genNum: { fontSize: 20, fontWeight: "700" },
  optRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
});

import * as Print from "expo-print";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { PersonPicker } from "@/components/PersonPicker";
import { relationLines } from "@/components/relation";
import { Button, Choice, Icon, IconButton, Muted, Screen } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { shareExisting } from "@/lib/files";
import { relationText } from "@/lib/kinship";
import { fullName, type Person } from "@/lib/model";
import { printGroups, printHtml, type PrintOptions } from "@/lib/printlist";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

const DOWN_MAX = 5; // shown as "All"

/** Choose who goes in the family list, then print it or save/share it as a PDF. */
export default function PrintScreen() {
  const c = useColors();
  const { graph, t, lang, homeId, focusId, customTerms } = useStore();
  const [startId, setStartId] = useState(focusId ?? homeId);
  const [up, setUp] = useState(2);
  const [down, setDown] = useState(DOWN_MAX);
  const [relatives, setRelatives] = useState(true);
  const [spouses, setSpouses] = useState(true);
  const [order, setOrder] = useState<PrintOptions["order"]>("top");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = graph.get(startId);

  const groups = useMemo(
    () => (start ? printGroups(graph, { startId: start.id, up, down: down >= DOWN_MAX ? Infinity : down, relatives, order }) : []),
    [graph, start, up, down, relatives, order],
  );
  const count = groups.reduce((n, g) => n + g.people.length, 0);

  const html = () => {
    if (!start) return "";
    // Generations numbered from the top of the list, whatever the order
    const top = Math.min(...groups.map((g) => g.gen));
    const row = (p: Person) => {
      const r = p.id === start.id ? null : relationText(graph, start.id, p.id, customTerms);
      const desc = graph.descendantsByGeneration(p.id).reduce((n, g) => n + g.length, 0);
      return {
        name: fullName(p),
        relation: p.id === start.id ? "—" : r ? relationLines(r, lang, t).main : "",
        born: [formatDate(p.birthDate, lang), p.birthPlace].filter(Boolean).join(", "),
        died: p.living ? "" : [formatDate(p.deathDate, lang)].filter(Boolean).join(", ") || "✿",
        spouses: graph.partners(p.id).map((q) => fullName(q)).join("; "),
        descendants: desc ? String(desc) : "",
        living: p.living,
      };
    };
    return printHtml(
      groups.map((g) => ({ label: t("genLabel", { n: g.gen - top + 1 }), rows: g.people.map(row) })),
      {
        title: graph.snapshot.familyName || t("familyOf", { name: fullName(start) }),
        subtitle: `${t("startFrom")}: ${fullName(start)} · ${t("peopleCount", { n: count })}`,
        footer: `${t("deceased")} · ${t("printedOn", { date: formatDate(new Date().toISOString().slice(0, 10), lang) })}`,
        showSpouses: spouses,
        cols: {
          no: t("colNo"),
          name: t("colName"),
          relation: t("colRelation", { name: start.givenName }),
          born: t("colBorn"),
          died: t("colDied"),
          spouse: t("colSpouse"),
          desc: t("colDesc"),
        },
      },
    );
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      // Closing the print dialog is not an error
      if (!/cancel/i.test(msg)) Alert.alert(t("printList"), t("somethingWrong", { msg }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t("printList")} back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Muted style={{ marginBottom: 12 }}>{t("printDesc")}</Muted>

        <Text style={[styles.label, { color: c.muted }]}>{t("startFrom")}</Text>
        <Pressable onPress={() => setPicking(true)} style={[styles.pick, { borderColor: c.border, backgroundColor: c.surface }]}>
          {start ? <Avatar person={start} size={44} /> : <Icon name="person-search" size={32} color={c.primary} />}
          <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{start ? fullName(start) : t("pickPerson")}</Text>
          <Icon name="chevron-right" color={c.muted} />
        </Pressable>

        <Stepper label={t("upGens")} value={up} min={0} max={5} onChange={setUp} />
        <Stepper label={t("downGens")} value={down} min={0} max={DOWN_MAX} onChange={setDown} display={down >= DOWN_MAX ? t("allGens") : String(down)} />

        <Toggle label={t("includeRelatives")} hint={t("includeRelativesHint")} value={relatives} onChange={setRelatives} />
        <Toggle label={t("showSpouses")} value={spouses} onChange={setSpouses} />

        <Choice
          label={t("orderLabel")}
          value={order}
          onChange={(v) => setOrder(v ?? "top")}
          options={[
            { value: "top", label: t("orderTop") },
            { value: "bottom", label: t("orderBottom") },
          ]}
        />

        <View style={[styles.summary, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Icon name="table-rows" color={c.primary} />
          <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>
            {t("peopleCount", { n: count })} · {t("gensCount", { n: groups.length })}
          </Text>
        </View>

        <Button title={t("printNow")} icon="print" disabled={!count || busy} onPress={() => run(async () => void (await Print.printAsync({ html: html(), orientation: Print.Orientation.landscape })))} style={{ marginTop: 16 }} />
        <Button
          title={t("sharePdf")}
          icon="share"
          kind="secondary"
          disabled={!count || busy}
          onPress={() =>
            run(async () => {
              const { uri } = await Print.printToFileAsync({ html: html(), width: 842, height: 595 });
              await shareExisting(uri, "application/pdf", t("printList"));
            })
          }
          style={{ marginTop: 10 }}
        />
        {busy ? <ActivityIndicator style={{ marginTop: 16 }} color={c.primary} /> : null}
      </ScrollView>
      <PersonPicker visible={picking} onClose={() => setPicking(false)} onPick={(p) => setStartId(p.id)} />
    </Screen>
  );
}

function Stepper({ label, value, min, max, onChange, display }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; display?: string }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{label}</Text>
      <IconButton icon="remove-circle-outline" label="-" onPress={() => onChange(Math.max(min, value - 1))} color={c.primary} />
      <Text style={{ color: c.text, fontSize: 17, minWidth: 44, textAlign: "center", fontWeight: "600" }}>{display ?? value}</Text>
      <IconButton icon="add-circle-outline" label="+" onPress={() => onChange(Math.min(max, value + 1))} color={c.primary} />
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <View style={[styles.row, { paddingVertical: 8 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 16 }}>{label}</Text>
        {hint ? <Muted>{hint}</Muted> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  summary: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 8 },
});

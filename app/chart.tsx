import * as Print from "expo-print";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { PersonPicker } from "@/components/PersonPicker";
import { Text } from "@/components/Text";
import { lifespan } from "@/components/TreeCard";
import { Button, Choice, Icon, IconButton, Muted, Screen } from "@/components/ui";
import { type ChartPhotos, chartHtml, PAPER, type PaperSize } from "@/lib/chart";
import { formatDate } from "@/lib/dates";
import { photoThumbnail, shareExisting } from "@/lib/files";
import { layoutTree } from "@/lib/layout";
import { fullName } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

/** At most this many photos go into one chart (keeps the PDF quick to make and to send) */
const MAX_PHOTOS = 300;

/** The family tree as a printable certificate ("Sijil Salasilah"), shared as a PDF or printed. */
export default function ChartScreen() {
  const c = useColors();
  const { graph, t, lang, focusId, homeId, treeOptions } = useStore();
  const [startId, setStartId] = useState(focusId ?? homeId);
  const [up, setUp] = useState(Math.min(treeOptions.up, 3));
  const [down, setDown] = useState(Math.max(treeOptions.down, 2));
  const [paper, setPaper] = useState<PaperSize>("a4");
  const [photos, setPhotos] = useState(true);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = graph.get(startId);

  const layout = useMemo(() => (start ? layoutTree(graph, start.id, { up, down, showAdd: false }) : null), [graph, start, up, down]);
  const people = layout ? layout.cards.filter((k) => k.person) : [];
  const gens = layout ? new Set(people.map((k) => Math.round(k.y))).size : 0;
  // A big tree on A4 gets very small: suggest A3
  const crowded = people.length > 40 && paper === "a4";

  const html = async () => {
    if (!start || !layout) return "";
    const pics: ChartPhotos = {};
    if (photos) {
      for (const k of people.slice(0, MAX_PHOTOS)) {
        const p = k.person!;
        if (!p.photo || pics[p.id]) continue;
        const small = await photoThumbnail(p.photo, 200);
        if (small) pics[p.id] = `data:image/jpeg;base64,${small.base64}`;
      }
    }
    const today = formatDate(new Date().toISOString().slice(0, 10), lang);
    return chartHtml(
      layout,
      paper,
      {
        kicker: t("chartKicker"),
        title: t("descendantsOf", { name: fullName(start) }),
        subtitle: graph.snapshot.familyName || undefined,
        footer: `${t("peopleCount", { n: people.length })} · ${t("gensCount", { n: gens })} · ${today}`,
        life: (p) => lifespan(p, t),
        deceased: t("deceased"),
      },
      pics,
    );
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (!/cancel/i.test(msg)) Alert.alert(t("chartTitle"), t("somethingWrong", { msg }));
    } finally {
      setBusy(false);
    }
  };

  const size = PAPER[paper];

  return (
    <Screen title={t("chartTitle")} back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Muted style={{ marginBottom: 12 }}>{t("chartDesc")}</Muted>

        <Text style={[styles.label, { color: c.muted }]}>{t("startFrom")}</Text>
        <Pressable onPress={() => setPicking(true)} style={[styles.pick, { borderColor: c.border, backgroundColor: c.surface }]}>
          {start ? <Avatar person={start} size={44} /> : <Icon name="person-search" size={32} color={c.primary} />}
          <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{start ? fullName(start) : t("pickPerson")}</Text>
          <Icon name="chevron-right" color={c.muted} />
        </Pressable>

        <Stepper label={t("generationsUp")} value={up} min={0} max={6} onChange={setUp} />
        <Stepper label={t("generationsDown")} value={down} min={0} max={6} onChange={setDown} />

        <Choice
          label={t("paperSize")}
          value={paper}
          onChange={(v) => setPaper(v ?? "a4")}
          options={[
            { value: "a4", label: "A4" },
            { value: "a3", label: "A3" },
          ]}
        />
        <View style={[styles.row, { paddingVertical: 8 }]}>
          <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{t("withPhotos")}</Text>
          <Switch value={photos} onValueChange={setPhotos} trackColor={{ true: c.primary }} />
        </View>

        <View style={[styles.summary, { backgroundColor: c.surface, borderColor: crowded ? c.focusRing : c.border }]}>
          <Icon name="account-tree" color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 15 }}>
              {t("peopleCount", { n: people.length })} · {t("gensCount", { n: gens })}
            </Text>
            {crowded ? <Muted>{t("chartCrowded")}</Muted> : null}
          </View>
        </View>

        <Button
          title={t("sharePdf")}
          icon="share"
          disabled={!people.length || busy}
          onPress={() =>
            run(async () => {
              const { uri } = await Print.printToFileAsync({ html: await html(), width: size.w, height: size.h });
              await shareExisting(uri, "application/pdf", t("chartTitle"));
            })
          }
          style={{ marginTop: 16 }}
        />
        <Button
          title={t("printNow")}
          icon="print"
          kind="secondary"
          disabled={!people.length || busy}
          onPress={() => run(async () => void (await Print.printAsync({ html: await html(), orientation: Print.Orientation.landscape })))}
          style={{ marginTop: 10 }}
        />
        {busy ? <ActivityIndicator style={{ marginTop: 16 }} color={c.primary} /> : null}
      </ScrollView>
      <PersonPicker visible={picking} onClose={() => setPicking(false)} onPick={(p) => setStartId(p.id)} />
    </Screen>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{label}</Text>
      <IconButton icon="remove-circle-outline" label="-" onPress={() => onChange(Math.max(min, value - 1))} color={c.primary} />
      <Text style={{ color: c.text, fontSize: 18, width: 28, textAlign: "center", fontWeight: "600" }}>{value}</Text>
      <IconButton icon="add-circle-outline" label="+" onPress={() => onChange(Math.min(max, value + 1))} color={c.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  summary: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8 },
});

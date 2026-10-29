import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Button, Choice, Field, Muted, Screen } from "@/components/ui";
import { parseInput, toInput } from "@/lib/dates";
import { fullName, type UnionStatus } from "@/lib/model";
import { useStore } from "@/lib/store";

/** Edit a marriage: status, dates, place, or remove it. */
export default function UnionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const { graph, t } = store;
  const u = graph.snapshot.unions.find((x) => x.id === id);
  const [status, setStatus] = useState<UnionStatus>(u?.status ?? "married");
  const [start, setStart] = useState(toInput(u?.startDate));
  const [end, setEnd] = useState(toInput(u?.endDate));
  const [place, setPlace] = useState(u?.place ?? "");
  const [notes, setNotes] = useState(u?.notes ?? "");
  const [err, setErr] = useState<{ start?: string; end?: string }>({});

  if (!u) {
    return (
      <Screen title={t("editMarriage")} back>
        <Muted style={{ margin: 24 }}>{t("noMatches")}</Muted>
      </Screen>
    );
  }
  const a = graph.get(u.partnerA)!;
  const b = graph.get(u.partnerB)!;

  const save = async () => {
    const s = parseInput(start);
    const e = status === "married" ? "" : parseInput(end);
    const errs = { start: s === null ? t("dateInvalid") : undefined, end: e === null ? t("dateInvalid") : undefined };
    setErr(errs);
    if (errs.start || errs.end) return;
    await store.saveUnion({ ...u, status, startDate: s || undefined, endDate: e || undefined, place: place.trim() || undefined, notes: notes.trim() || undefined });
    router.back();
  };

  const remove = () =>
    Alert.alert(t("removeMarriage"), t("removeLinkQ", { a: a.givenName, b: b.givenName }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("remove"),
        style: "destructive",
        onPress: async () => {
          await store.removeUnion(u.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen title={t("editMarriage")} back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Muted style={{ marginBottom: 16 }}>
          {fullName(a)} & {fullName(b)}
        </Muted>
        <Choice
          value={status}
          onChange={(v) => setStatus(v ?? "married")}
          options={(["married", "divorced", "widowed"] as UnionStatus[]).map((s) => ({ value: s, label: t(`status_${s}`) }))}
        />
        <Field label={t("marriageDate")} value={start} onChangeText={setStart} hint={t("dateHint")} error={err.start} keyboardType="numbers-and-punctuation" />
        <Field label={t("marriagePlace")} value={place} onChangeText={setPlace} autoCapitalize="words" />
        {status === "divorced" ? (
          <Field label={t("divorceDate")} value={end} onChangeText={setEnd} hint={t("dateHint")} error={err.end} keyboardType="numbers-and-punctuation" />
        ) : null}
        <Field label={t("notes")} value={notes} onChangeText={setNotes} multiline />
        <Button title={t("save")} onPress={save} />
        <Button title={t("removeMarriage")} kind="danger" onPress={remove} style={{ marginTop: 12 }} />
      </ScrollView>
    </Screen>
  );
}

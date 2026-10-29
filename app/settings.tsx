import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { PersonPicker } from "@/components/PersonPicker";
import { Choice, Field, Icon, Muted, Row, Screen, Section } from "@/components/ui";
import { pickTextFile, saveTextFile } from "@/lib/files";
import { fullName } from "@/lib/model";
import { IS_PREVIEW } from "@/lib/open-repo";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

const stamp = () => new Date().toISOString().slice(0, 10);

export default function SettingsScreen() {
  const c = useColors();
  const store = useStore();
  const { graph, t, lang, setLang, homeId } = store;
  const [name, setName] = useState(graph.snapshot.familyName);
  const [pickHome, setPickHome] = useState(false);
  const [busy, setBusy] = useState(false);
  const home = graph.get(homeId);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert(t("backup"), t("somethingWrong", { msg: String((e as Error)?.message ?? e) }));
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = () =>
    run(async () => {
      const text = await store.backupText();
      if (await saveTextFile(`waris-backup-${stamp()}.json`, text, "application/json")) Alert.alert(t("backup"), t("backupSaved"));
    });

  const restore = () =>
    run(async () => {
      const file = await pickTextFile();
      if (!file) return;
      let n: number;
      try {
        n = store.peekBackup(file.text);
      } catch {
        Alert.alert(t("restoreBackup"), t("backupFailed"));
        return;
      }
      Alert.alert(t("restoreBackup"), t("restoreQ", { n }), [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("restoreBackup"),
          style: "destructive",
          onPress: () =>
            run(async () => {
              const count = await store.restore(file.text);
              Alert.alert(t("restoreBackup"), t("restored", { n: count }));
              router.dismissTo("/");
            }),
        },
      ]);
    });

  const exportGedcom = () =>
    Alert.alert(t("exportGedcom"), t("gedcomLiving"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("no"), onPress: () => run(async () => void (await saveTextFile(`waris-${stamp()}.ged`, store.gedcom(false), "application/octet-stream"))) },
      { text: t("yes"), onPress: () => run(async () => void (await saveTextFile(`waris-${stamp()}.ged`, store.gedcom(true), "application/octet-stream"))) },
    ]);

  return (
    <Screen title={t("settings")} back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Field
          label={t("familyName")}
          value={name}
          onChangeText={setName}
          onBlur={() => store.setFamilyName(name)}
          onSubmitEditing={() => store.setFamilyName(name)}
          placeholder={t("familyNameHint")}
          returnKeyType="done"
        />
        <Choice
          label={t("language")}
          value={lang}
          onChange={(v) => v && setLang(v)}
          options={[
            { value: "bm", label: "Bahasa Melayu" },
            { value: "en", label: "English" },
          ]}
        />

        <Section>
          <Row
            title={home ? fullName(home) : t("pickPerson")}
            subtitle={t("isHome")}
            left={<Icon name="home" color={c.primary} />}
            onPress={() => setPickHome(true)}
          />
          <Row title={t("findRelationship")} left={<Icon name="device-hub" color={c.primary} />} onPress={() => router.push("/relate")} />
          <Row title={t("people")} subtitle={t("stats", { p: graph.size, c: graph.snapshot.unions.length })} left={<Icon name="people" color={c.primary} />} onPress={() => router.push("/people")} last />
        </Section>

        <Section title={t("backup")}>
          <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
            <Muted>{t("backupDesc")}</Muted>
          </View>
          <Row title={t("exportBackup")} left={<Icon name="save-alt" color={c.primary} />} onPress={exportBackup} />
          <Row title={t("restoreBackup")} left={<Icon name="restore" color={c.primary} />} onPress={restore} />
          <Row title={t("exportGedcom")} subtitle={t("gedcomDesc")} left={<Icon name="ios-share" color={c.primary} />} onPress={exportGedcom} last />
        </Section>

        {busy ? <ActivityIndicator style={{ marginTop: 16 }} color={c.primary} /> : null}
        <Muted style={{ marginTop: 20, textAlign: "center" }}>
          {t("about")}
          {IS_PREVIEW ? "\n(Web preview: data is not saved.)" : ""}
        </Muted>
      </ScrollView>
      <PersonPicker visible={pickHome} onClose={() => setPickHome(false)} onPick={(p) => store.setHome(p.id)} />
    </Screen>
  );
}

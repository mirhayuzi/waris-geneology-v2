import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from "react-native";
import { PersonPicker } from "@/components/PersonPicker";
import { Sheet } from "@/components/Sheet";
import { useRestore } from "@/components/useRestore";
import { Button, Choice, Field, Icon, Muted, Row, Screen, Section } from "@/components/ui";
import { pickRestoreFiles, saveTextFile, shareFile, XLSX_MIME } from "@/lib/files";
import { fullName } from "@/lib/model";
import { IS_PREVIEW } from "@/lib/open-repo";
import { appVersion } from "@/lib/version";
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSize, setShareSize] = useState<"small" | "full">("small");
  const [hideLiving, setHideLiving] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelPhotos, setExcelPhotos] = useState(false);
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
      if (await saveTextFile(`waris-backup-${stamp()}.json`, text, "application/json")) {
        store.markBackedUp();
        Alert.alert(t("backup"), t("backupSaved"));
      }
    });

  const shareBackup = (how: "share" | "save") =>
    run(async () => {
      const text = await store.backupText({ photos: shareSize === "full", hideLiving });
      const name = `waris-${(graph.snapshot.familyName || "keluarga").replace(/[^\w-]+/g, "-").toLowerCase()}-${stamp()}.json`;
      setShareOpen(false);
      if (how === "share") {
        if (await shareFile(name, text, "application/json")) store.markBackedUp();
      } else if (await saveTextFile(name, text, "application/json")) {
        store.markBackedUp();
        Alert.alert(t("backup"), t("backupSaved"));
      }
    });

  const flow = useRestore(run);
  const restore = () =>
    run(async () => {
      const files = await pickRestoreFiles();
      if (files && (files.excel || files.texts.length)) flow.choose(files);
    });

  const exportExcel = (how: "share" | "save") =>
    run(async () => {
      const name = `salasilah-${(graph.snapshot.familyName || "waris").replace(/[^\w-]+/g, "-").toLowerCase()}-${stamp()}.xlsx`;
      const b64 = await store.excelBase64({ photos: excelPhotos });
      setExcelOpen(false);
      if (how === "share") {
        if (await shareFile(name, b64, XLSX_MIME, { base64: true })) store.markBackedUp();
      } else if (await saveTextFile(name, b64, XLSX_MIME, { base64: true })) {
        store.markBackedUp();
        Alert.alert(t("exportExcel"), t("backupSaved"));
      }
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
          <Row title={t("people")} subtitle={t("stats", { p: graph.size, c: graph.snapshot.unions.length })} left={<Icon name="people" color={c.primary} />} onPress={() => router.push("/people")} />
          <Row title={t("needsLinking")} subtitle={t("needsLinkingDesc")} left={<Icon name="link" color={c.primary} />} onPress={() => router.push("/unlinked")} />
          <Row
            title={t("duplicates")}
            subtitle={t("duplicatesShort")}
            left={<Icon name="people-alt" color={c.primary} />}
            onPress={() => router.push("/duplicates")}
          />
          <Row title={t("printList")} subtitle={t("printDesc")} left={<Icon name="print" color={c.primary} />} onPress={() => router.push("/print")} last />
        </Section>

        <Section title={t("shareFamily")}>
          <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
            <Muted>{t("shareFamilyDesc")}</Muted>
          </View>
          <Row title={t("shareFamily")} left={<Icon name="share" color={c.primary} />} onPress={() => setShareOpen(true)} last />
        </Section>

        <Section title={t("backup")}>
          <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
            <Muted>{t("backupDesc")}</Muted>
          </View>
          <Row title={t("exportBackup")} left={<Icon name="save-alt" color={c.primary} />} onPress={exportBackup} />
          <Row title={t("restoreBackup")} subtitle={t("restoreDesc")} left={<Icon name="restore" color={c.primary} />} onPress={restore} />
          <Row title={t("exportExcel")} subtitle={t("exportExcelDesc")} left={<Icon name="grid-on" color={c.primary} />} onPress={() => setExcelOpen(true)} />
          <Row title={t("exportGedcom")} subtitle={t("gedcomDesc")} left={<Icon name="ios-share" color={c.primary} />} onPress={exportGedcom} last />
        </Section>

        <Section>
          <Row
            title={t("aboutWaris")}
            subtitle={`${t("versionLine", { v: appVersion().version })} · ${t("whatsNew")}`}
            left={<Icon name="info-outline" color={c.primary} />}
            onPress={() => router.push("/about")}
            last
          />
        </Section>

        {busy ? <ActivityIndicator style={{ marginTop: 16 }} color={c.primary} /> : null}
        <Muted style={{ marginTop: 20, textAlign: "center" }}>
          {t("about")}
          {IS_PREVIEW ? "\n(Web preview: data is not saved.)" : ""}
        </Muted>
      </ScrollView>
      <Sheet visible={shareOpen} onClose={() => setShareOpen(false)} title={t("shareFamily")}>
        <Choice
          value={shareSize}
          onChange={(v) => setShareSize(v ?? "small")}
          options={[
            { value: "small", label: t("shareSmall") },
            { value: "full", label: t("shareFull") },
          ]}
        />
        <Muted style={{ marginTop: -6, marginBottom: 12 }}>{t(shareSize === "small" ? "shareSmallHint" : "shareFullHint")}</Muted>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 16 }}>{t("hideLiving")}</Text>
            <Muted>{t("hideLivingHint")}</Muted>
          </View>
          <Switch value={hideLiving} onValueChange={setHideLiving} trackColor={{ true: c.primary }} />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          <Button title={t("saveToPhone")} kind="secondary" icon="save-alt" onPress={() => shareBackup("save")} style={{ flex: 1 }} />
          <Button title={t("shareNow")} icon="share" onPress={() => shareBackup("share")} style={{ flex: 1 }} />
        </View>
      </Sheet>
      <Sheet visible={excelOpen} onClose={() => setExcelOpen(false)} title={t("exportExcel")}>
        <Muted style={{ marginBottom: 12 }}>{t("exportExcelDesc")}</Muted>
        <Choice
          value={excelPhotos ? "yes" : "no"}
          onChange={(v) => setExcelPhotos(v === "yes")}
          options={[
            { value: "no", label: t("excelNoPhotos") },
            { value: "yes", label: t("excelWithPhotos") },
          ]}
        />
        <Muted style={{ marginTop: -6 }}>{t(excelPhotos ? "excelWithPhotosHint" : "excelNoPhotosHint")}</Muted>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          <Button title={t("saveToPhone")} kind="secondary" icon="save-alt" onPress={() => exportExcel("save")} style={{ flex: 1 }} disabled={busy} />
          <Button title={t("shareNow")} icon="share" onPress={() => exportExcel("share")} style={{ flex: 1 }} disabled={busy} />
        </View>
        {busy ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
            <ActivityIndicator color={c.primary} />
            <Muted>{t("preparingFile")}</Muted>
          </View>
        ) : null}
      </Sheet>
      <PersonPicker visible={pickHome} onClose={() => setPickHome(false)} onPick={(p) => store.setHome(p.id)} />
    </Screen>
  );
}

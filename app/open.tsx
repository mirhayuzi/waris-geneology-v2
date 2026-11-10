import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { useRestore } from "@/components/useRestore";
import { Button, Icon, Muted, Screen } from "@/components/ui";
import { pickRestoreFiles, readIncomingFile, type RestoreFiles } from "@/lib/files";
import { forgetIncomingFile, getIncomingFile } from "@/lib/incoming-file";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

/** A family file opened with Waris from WhatsApp, Files or email: Merge or Replace. */
export default function OpenFileScreen() {
  const c = useColors();
  // A new link each time a file is opened (t changes), kept outside the page address
  const { t: openedAt } = useLocalSearchParams<{ t?: string }>();
  const { t, graph, peekBackup } = useStore();
  const [files, setFiles] = useState<RestoreFiles | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [failure, setFailure] = useState<"access" | "format" | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      forgetIncomingFile(openedAt);
    } catch (e) {
      Alert.alert(t("restoreBackup"), t("somethingWrong", { msg: String((e as Error)?.message ?? e) }));
    } finally {
      setBusy(false);
    }
  };
  const flow = useRestore(run);

  const preview = (f: RestoreFiles) => {
    try {
      const n = peekBackup(f);
      setFiles(f);
      setCount(n);
      setFailure(null);
    } catch {
      setFailure("format");
    }
  };

  const chooseFile = async () => {
    setBusy(true);
    try {
      const f = await pickRestoreFiles();
      if (f) preview(f);
    } catch {
      setFailure("access");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    forgetIncomingFile(openedAt);
    router.dismissTo("/");
  };

  useEffect(() => {
    const uri = getIncomingFile(openedAt);
    if (!uri) return setFailure("access");
    let active = true;
    setFailure(null);
    setFiles(null);
    setCount(null);
    (async () => {
      try {
        const f = await readIncomingFile(uri);
        if (active) preview(f);
      } catch {
        if (active) setFailure("access");
      }
    })();
    // A remount can read this same request again. A previous request finishing late
    // must not replace the preview for a newly opened file.
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedAt]);

  return (
    <Screen title={t("openFile")} back>
      <View style={styles.body}>
        {failure ? (
          <>
            <Icon name="error-outline" size={56} color={c.danger} />
            <Muted style={styles.center}>{t(failure === "access" ? "incomingFileUnavailable" : "backupFailed")}</Muted>
            <Button title={t("chooseFile")} icon="folder-open" onPress={() => void chooseFile()} disabled={busy} />
            <Button title={t("done")} kind="secondary" onPress={dismiss} disabled={busy} />
            {busy ? <ActivityIndicator color={c.primary} /> : null}
          </>
        ) : !files || count === null ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <>
            <Icon name={files.excel ? "grid-on" : "family-restroom"} size={56} color={c.primary} />
            <Text style={[styles.title, { color: c.text }]}>{t("openFileTitle", { n: count })}</Text>
            <Muted style={styles.center}>{graph.size ? t("openFileHow", { n: graph.size }) : t("openFileEmpty")}</Muted>
            {graph.size ? (
              <>
                <Button title={t("merge")} icon="merge-type" onPress={() => flow.restoreAs(files, "merge")} disabled={busy} style={styles.btn} />
                <Button title={t("replace")} kind="danger" icon="swap-horiz" onPress={() => flow.confirmReplace(files, count)} disabled={busy} style={styles.btn} />
              </>
            ) : (
              <Button title={t("restoreBackup")} icon="download" onPress={() => flow.restoreAs(files, "replace")} disabled={busy} style={styles.btn} />
            )}
            <Button title={t("cancel")} kind="plain" onPress={dismiss} disabled={busy} />
            {busy ? <ActivityIndicator color={c.primary} style={{ marginTop: 12 }} /> : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 6 },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: 10 },
  center: { textAlign: "center", marginBottom: 14 },
  btn: { alignSelf: "stretch", marginTop: 8 },
});

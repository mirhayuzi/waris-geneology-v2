import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useRestore } from "@/components/useRestore";
import { Button, Icon, Muted, Screen } from "@/components/ui";
import { readIncomingFile, type RestoreFiles } from "@/lib/files";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

/** A family file opened with Waris from WhatsApp, Files or email: Merge or Replace. */
export default function OpenFileScreen() {
  const c = useColors();
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const { t, graph } = useStore();
  const [files, setFiles] = useState<RestoreFiles | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert(t("restoreBackup"), t("somethingWrong", { msg: String((e as Error)?.message ?? e) }));
    } finally {
      setBusy(false);
    }
  };
  const flow = useRestore(run);

  useEffect(() => {
    if (!uri) return setFailed(true);
    (async () => {
      try {
        const f = await readIncomingFile(uri);
        const n = flow.peek(f);
        if (n === null) return setFailed(true);
        setFiles(f);
        setCount(n);
      } catch {
        setFailed(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  return (
    <Screen title={t("openFile")} back>
      <View style={styles.body}>
        {failed ? (
          <>
            <Icon name="error-outline" size={56} color={c.danger} />
            <Muted style={styles.center}>{t("backupFailed")}</Muted>
            <Button title={t("done")} kind="secondary" onPress={() => router.dismissTo("/")} />
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
            <Button title={t("cancel")} kind="plain" onPress={() => router.dismissTo("/")} disabled={busy} />
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

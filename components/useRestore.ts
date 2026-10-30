import { router } from "expo-router";
import { Alert } from "react-native";
import type { RestoreFiles } from "@/lib/files";
import { useStore } from "@/lib/store";

/**
 * The Restore flow shared by Settings and "Open with Waris": check the file, then
 * Merge (default) or Replace (asked twice), then report and offer duplicates.
 * `run` wraps the work so the caller can show a spinner and report errors.
 */
export function useRestore(run: (fn: () => Promise<void>) => Promise<void>) {
  const store = useStore();
  const { t, graph } = store;

  /** Number of people in the file, or null (after telling the user) when it can't be read. */
  const peek = (files: RestoreFiles): number | null => {
    try {
      return store.peekBackup(files);
    } catch {
      Alert.alert(t("restoreBackup"), t("backupFailed"));
      return null;
    }
  };

  const restoreAs = (files: RestoreFiles, mode: "replace" | "merge") =>
    run(async () => {
      const r = await store.restore(files, mode);
      router.dismissTo("/");
      const photoNote = r.photos ? `\n${t("photosRestored", { n: r.photos })}` : "";
      if (mode === "merge") {
        Alert.alert(t("restoreBackup"), t("merged", { a: r.added, u: r.updated }) + photoNote);
        // Same person typed separately by two relatives? Offer to join them.
        if (r.added) setTimeout(() => router.push("/duplicates"), 300);
      } else Alert.alert(t("restoreBackup"), t("restored", { n: r.total }) + photoNote);
    });

  /** Replace deletes this phone's tree first, so it is confirmed separately. */
  const confirmReplace = (files: RestoreFiles, n: number) =>
    Alert.alert(t("restoreBackup"), t("restoreQ", { n }), [
      { text: t("cancel"), style: "cancel" },
      { text: t("replace"), style: "destructive", onPress: () => void restoreAs(files, "replace") },
    ]);

  /** Asks Merge or Replace (an empty tree just takes the file). */
  const choose = (files: RestoreFiles) => {
    const n = peek(files);
    if (n === null) return;
    if (graph.size === 0) return void restoreAs(files, "replace");
    Alert.alert(t("restoreBackup"), t("restoreHow", { n }), [
      { text: t("cancel"), style: "cancel" },
      { text: t("replace"), style: "destructive", onPress: () => confirmReplace(files, n) },
      { text: t("merge"), onPress: () => void restoreAs(files, "merge") },
    ]);
  };

  return { peek, choose, restoreAs, confirmReplace };
}

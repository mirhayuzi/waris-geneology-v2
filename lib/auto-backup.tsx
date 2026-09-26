import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFamily } from "@/lib/family-store";
import { membersToCSV, marriagesToCSV, parentChildToCSV } from "@/lib/csv-export";
import { configureGoogleSignIn, getAccessToken, syncAllToDrive } from "@/lib/google-drive";

export const BACKUP_DATE_KEY = "@waris_last_backup";
export const BACKUP_AUTO_KEY = "@waris_auto_backup";

/** Wait this long after the last change so a burst of edits becomes one backup. */
const AUTO_BACKUP_DELAY_MS = 30_000;

export function formatBackupTime(date: Date): string {
  return date.toLocaleString("en-MY");
}

/**
 * Backs the family tree up to Google Drive automatically after it changes,
 * when "Auto-backup" is switched on in Backup & Restore and the user is signed in.
 * Renders nothing.
 */
export function AutoBackup() {
  const { data, isLoading } = useFamily();
  const loadedAt = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || isLoading) return;

    // Remember the version loaded at startup; only later edits trigger a backup
    if (loadedAt.current === null) {
      loadedAt.current = data.updatedAt;
      return;
    }
    if (data.updatedAt === loadedAt.current || data.persons.length === 0) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        if ((await AsyncStorage.getItem(BACKUP_AUTO_KEY)) !== "true") return;
        if (!(await getAccessToken())) return;
        const result = await syncAllToDrive(
          membersToCSV(data.persons),
          marriagesToCSV(data.marriages),
          parentChildToCSV(data.parentChildren),
        );
        if (result.success) {
          await AsyncStorage.setItem(BACKUP_DATE_KEY, formatBackupTime(new Date()));
        }
      } catch (e) {
        // Automatic backups are best-effort; the manual button still reports errors
        console.warn("Auto-backup failed:", e);
      }
    }, AUTO_BACKUP_DELAY_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, isLoading]);

  return null;
}

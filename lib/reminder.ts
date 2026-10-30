/**
 * When to suggest a backup. The whole tree lives on one phone, so after enough changes
 * (or a long time) Waris gently asks. "Later" snoozes it for a week.
 */
export function shouldRemindBackup(s: { people: number; changes: number; lastBackup?: string; snoozeUntil?: string; now: Date }): boolean {
  if (s.people < 5 || s.changes === 0) return false;
  if (s.snoozeUntil && new Date(s.snoozeUntil) > s.now) return false;
  if (s.changes >= 20) return true;
  if (!s.lastBackup) return s.changes >= 5;
  const days = (s.now.getTime() - new Date(s.lastBackup).getTime()) / 86400000;
  return days >= 30;
}

export const SNOOZE_DAYS = 7;

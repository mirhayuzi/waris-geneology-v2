import { expect, it } from "vitest";
import { shouldRemindBackup } from "../reminder";

const now = new Date("2026-11-01T10:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

it("reminds after enough changes or a long time, never while snoozed", () => {
  const base = { people: 40, now };
  expect(shouldRemindBackup({ ...base, changes: 0 })).toBe(false); // nothing new
  expect(shouldRemindBackup({ ...base, changes: 3 })).toBe(false);
  expect(shouldRemindBackup({ ...base, changes: 5 })).toBe(true); // never backed up
  expect(shouldRemindBackup({ ...base, changes: 5, lastBackup: daysAgo(3) })).toBe(false);
  expect(shouldRemindBackup({ ...base, changes: 1, lastBackup: daysAgo(31) })).toBe(true);
  expect(shouldRemindBackup({ ...base, changes: 25, lastBackup: daysAgo(1) })).toBe(true);
  expect(shouldRemindBackup({ ...base, changes: 25, snoozeUntil: daysAgo(-2) })).toBe(false);
  expect(shouldRemindBackup({ ...base, changes: 25, snoozeUntil: daysAgo(1) })).toBe(true);
  expect(shouldRemindBackup({ people: 3, changes: 50, now })).toBe(false); // tiny tree
});

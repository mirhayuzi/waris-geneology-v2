/**
 * Dates are stored as "YYYY-MM-DD", or just "YYYY" when only the year is known
 * (common for older relatives).
 */

export const MONTH_NAMES = {
  en: ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"],
  bm: ["Januari", "Februari", "Mac", "April", "Mei", "Jun",
    "Julai", "Ogos", "September", "Oktober", "November", "Disember"],
};

export function isYearOnly(value: string): boolean {
  return /^\d{4}$/.test(value.trim());
}

export function parseDate(value: string): { year: number; month?: number; day?: number } | null {
  const v = value.trim();
  if (isYearOnly(v)) return { year: parseInt(v, 10) };
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (!m) return null;
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
}

/** Human-friendly date, e.g. "2 March 1950", or "1920" for a year-only date. Unknown formats are returned as-is. */
export function formatDate(value: string | undefined, lang: "en" | "bm"): string {
  if (!value) return "";
  const p = parseDate(value);
  if (!p) return value;
  if (p.month === undefined || p.day === undefined) return String(p.year);
  const month = MONTH_NAMES[lang][p.month - 1];
  if (!month) return value;
  return `${p.day} ${month} ${p.year}`;
}

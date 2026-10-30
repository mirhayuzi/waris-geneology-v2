/**
 * Genealogy dates are often partial: only a year, or "about 1950".
 * Stored form: "1982" | "1982-03" | "1982-03-12", with an optional "~" prefix for "about".
 */

export interface PartialDate {
  year: number;
  month?: number;
  day?: number;
  approx?: boolean;
}

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  bm: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"],
};

const pad = (n: number) => String(n).padStart(2, "0");

function valid(d: PartialDate): boolean {
  if (d.year < 1000 || d.year > 2999) return false;
  if (d.month !== undefined && (d.month < 1 || d.month > 12)) return false;
  if (d.day !== undefined) {
    if (d.month === undefined) return false;
    const max = new Date(Date.UTC(d.year, d.month, 0)).getUTCDate();
    if (d.day < 1 || d.day > max) return false;
  }
  return true;
}

/** Parse a stored date ("~1950", "1982-03-12"). Returns null when empty or invalid. */
export function parseStored(value: string | undefined | null): PartialDate | null {
  if (!value) return null;
  let v = value.trim();
  const approx = v.startsWith("~");
  if (approx) v = v.slice(1);
  const m = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/.exec(v);
  if (!m) return null;
  const d: PartialDate = {
    year: +m[1],
    month: m[2] ? +m[2] : undefined,
    day: m[3] ? +m[3] : undefined,
    approx: approx || undefined,
  };
  return valid(d) ? d : null;
}

export function toStored(d: PartialDate): string {
  let s = String(d.year);
  if (d.month) s += `-${pad(d.month)}`;
  if (d.month && d.day) s += `-${pad(d.day)}`;
  return (d.approx ? "~" : "") + s;
}

/**
 * Parse what a person types. Accepts Malaysian day-first order:
 * "1982", "~1950", "c 1950", "3/1982", "12/3/1982", "12-03-1982", "12.3.1982", "1982-03-12".
 * Returns the stored form, "" for empty input, or null when it can't be understood.
 */
export function parseInput(text: string): string | null {
  let v = text.trim().toLowerCase();
  if (!v) return "";
  let approx = false;
  const approxMatch = /^(~|c\.?|ca\.?|abt\.?|about|lebih kurang|lbh kurang|sekitar)\s*/.exec(v);
  if (approxMatch) {
    approx = true;
    v = v.slice(approxMatch[0].length).trim();
  }
  let d: PartialDate | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})$/.exec(v))) d = { year: +m[1] };
  else if ((m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(v)))
    d = { year: +m[1], month: +m[2], day: m[3] ? +m[3] : undefined };
  else if ((m = /^(\d{1,2})[/.\-](\d{4})$/.exec(v))) d = { year: +m[2], month: +m[1] };
  else if ((m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(v)))
    d = { year: +m[3], month: +m[2], day: +m[1] };
  if (!d) return null;
  if (approx) d.approx = true;
  return valid(d) ? toStored(d) : null;
}

/** "12 Mar 1982", "Mar 1982", "1982", "c. 1950" */
export function formatDate(value: string | undefined, lang: "en" | "bm" = "en"): string {
  const d = parseStored(value);
  if (!d) return value ?? "";
  let s = String(d.year);
  if (d.month) s = `${MONTHS[lang][d.month - 1]} ${s}`;
  if (d.month && d.day) s = `${d.day} ${s}`;
  return d.approx ? `${lang === "bm" ? "kira-kira" : "c."} ${s}` : s;
}

/** Turns a stored date back into the editable text form (day-first). */
export function toInput(value: string | undefined): string {
  const d = parseStored(value);
  if (!d) return value ?? "";
  let s = String(d.year);
  if (d.month) s = `${d.month}/${s}`;
  if (d.month && d.day) s = `${d.day}/${s}`;
  return (d.approx ? "~" : "") + s;
}

export function yearOf(value: string | undefined): number | undefined {
  return parseStored(value)?.year;
}

/** For sorting: unknown dates sort last. */
export function sortKey(value: string | undefined): string {
  const d = parseStored(value);
  if (!d) return "9999";
  return `${d.year}-${pad(d.month ?? 0)}-${pad(d.day ?? 0)}`;
}

/** Age in whole years, or undefined if it can't be worked out. */
export function ageAt(birth: string | undefined, at?: string): number | undefined {
  const b = parseStored(birth);
  if (!b) return undefined;
  const now = new Date();
  const e = at ? parseStored(at) : { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  if (!e) return undefined;
  let age = e.year - b.year;
  if (b.month && e.month) {
    if (e.month < b.month || (e.month === b.month && b.day && e.day && e.day < b.day)) age--;
  }
  return age >= 0 ? age : undefined;
}

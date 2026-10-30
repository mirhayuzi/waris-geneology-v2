import { type ParsedBackup, sanitize } from "./backup";
import { parseInput } from "./dates";
import { W } from "./excel-export";
import { type FamilySnapshot, type LinkKind, newId, nowIso, type ParentLink, type Person, type Sex, type Union, type UnionStatus } from "./model";
import { toBase64 } from "./xlsx";
import type { CellValue, ReadSheet } from "./xlsx-read";

/**
 * Reads a Waris Excel file (made by "Export to Excel", possibly edited in Excel,
 * Google Sheets or WPS) back into a family tree. Uses the data tabs only:
 * Ahli / People, Perkahwinan / Marriages, Ibu_Bapa_Anak / Parents_Children, and
 * photos from the Gambar / Photos tab or from picture files named by ID (P0012.jpg).
 * Headers are matched by name in either language, so column order doesn't matter.
 */

const PEOPLE_KEYS = [
  "id", "fullName", "prefix", "givenName", "fatherName", "surname", "sex", "status", "birthDate", "birthPlace", "deathDate", "deathPlace", "burialPlace",
  "fatherId", "fatherNameF", "motherId", "motherNameF", "spouses", "childCount", "descCount", "relation", "religion", "ethnicity", "occupation", "phone", "notes", "nickname", "warisId",
] as const;
const UNION_KEYS = ["id", "husbandId", "husband", "wifeId", "wife", "status", "startDate", "endDate", "place", "notes"] as const;
const LINK_KEYS = ["id", "childId", "child", "parentId", "parent", "role", "kind"] as const;

/** "bin/binti\n(nama bapa)" -> "bin/binti" */
const normHeader = (s: CellValue | undefined) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function headerMap<K extends string>(keys: readonly K[], cols: (string[] | undefined)[]): Map<string, K> {
  const m = new Map<string, K>();
  for (const list of cols) list?.forEach((h, i) => keys[i] && m.set(normHeader(h), keys[i]));
  return m;
}
const PEOPLE_H = headerMap(PEOPLE_KEYS, [W.bm.peopleCols, W.en.peopleCols]);
PEOPLE_H.set("jantina", "sex").set("sex", "sex").set("nama", "givenName").set("name", "givenName");
const UNION_H = headerMap(UNION_KEYS, [W.bm.unionsCols, W.en.unionsCols]);
const LINK_H = headerMap(LINK_KEYS, [W.bm.linksCols, W.en.linksCols]);

interface Table<K extends string> {
  sheet: ReadSheet;
  col: Partial<Record<K, number>>;
  /** index of the header row */
  head: number;
}

/** Finds the header row (first cell "ID") and which column holds each field. */
function findTable<K extends string>(sheet: ReadSheet, map: Map<string, K>, need: K[]): Table<K> | null {
  for (let r = 0; r < Math.min(sheet.rows.length, 15); r++) {
    const row = sheet.rows[r] ?? [];
    if (normHeader(row[0]) !== "id") continue;
    const col: Partial<Record<K, number>> = {};
    row.forEach((h, i) => {
      const k = map.get(normHeader(h));
      if (k && col[k] === undefined) col[k] = i;
    });
    if (need.every((k) => col[k] !== undefined)) return { sheet, col, head: r };
  }
  return null;
}

const text = (v: CellValue | undefined) => (v === null || v === undefined ? "" : typeof v === "number" ? String(Number.isInteger(v) ? v : +v.toFixed(6)) : String(v)).trim();

function pick<K extends string>(t: Table<K>, row: CellValue[], k: K): string {
  const i = t.col[k];
  return i === undefined ? "" : text(row[i]);
}

/** Excel day number or typed text ("12/3/1982", "1982", "~1950") to a stored date. */
function dateOf(v: CellValue | undefined, warn: () => void): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    if (Number.isNaN(d.getTime()) || v < 1) return warn(), undefined;
    return d.toISOString().slice(0, 10);
  }
  const s = parseInput(String(v));
  if (s === null) return warn(), undefined;
  return s || undefined;
}

function sexOf(s: string): Sex | undefined {
  const v = s.toLowerCase();
  if (/^(l|m|lelaki|male|laki-laki|lk)$/.test(v)) return "male";
  if (/^(p|f|perempuan|female|pr|wanita)$/.test(v)) return "female";
  return undefined;
}

function statusOf(s: string): UnionStatus {
  const v = s.toLowerCase();
  if (/cerai|divorc/.test(v)) return "divorced";
  if (/balu|duda|widow|kematian|meninggal/.test(v)) return "widowed";
  return "married";
}

function kindOf(s: string): LinkKind {
  const v = s.toLowerCase();
  for (const lang of [W.bm, W.en]) for (const [k, label] of Object.entries(lang.kind)) if (label === v) return k as LinkKind;
  if (/angkat|adopt/.test(v)) return "adopted";
  if (/tiri|step/.test(v)) return "step";
  if (/pelihara|foster/.test(v)) return "foster";
  if (/susu|milk/.test(v)) return "milk";
  return "birth";
}

const sheetNamed = (book: ReadSheet[], names: string[]) => book.find((s) => names.some((n) => s.name.toLowerCase() === n.toLowerCase()));

export interface ExcelImport {
  parsed: ParsedBackup;
  people: number;
  photos: number;
  /** Cells that could not be read (bad dates, unknown IDs) */
  skipped: number;
}

export function excelToBackup(book: ReadSheet[], opts: { images?: { name: string; base64: string }[] } = {}): ExcelImport {
  const now = nowIso();
  let skipped = 0;
  const warn = () => void skipped++;

  // ---- People ---------------------------------------------------------------------
  const candidates = [sheetNamed(book, [W.bm.sheets.people, W.en.sheets.people]), ...book].filter(Boolean) as ReadSheet[];
  let people: Table<(typeof PEOPLE_KEYS)[number]> | null = null;
  for (const s of candidates) if ((people = findTable(s, PEOPLE_H, ["id", "givenName"]))) break;
  if (!people) throw new Error("not-waris-excel");

  const byCode = new Map<string, Person>();
  const sexHint = new Map<string, Sex>();
  const parentCols: { child: string; father: string; mother: string }[] = [];
  people.sheet.rows.slice(people.head + 1).forEach((row, i) => {
    if (!row) return;
    const name = pick(people!, row, "givenName") || pick(people!, row, "fullName").split(/\s+bin(?:ti)?\s+/i)[0];
    let code = pick(people!, row, "id");
    if (!name && !code) return;
    if (!name) return warn();
    if (!code) code = `ROW${i + 1}`;
    if (byCode.has(code.toUpperCase())) return warn();
    const deathDate = dateOf(row[people!.col.deathDate ?? -1], warn);
    const status = pick(people!, row, "status").toLowerCase();
    const p: Person = {
      id: pick(people!, row, "warisId") || newId(),
      givenName: name,
      prefix: pick(people!, row, "prefix") || undefined,
      fatherName: pick(people!, row, "fatherName") || undefined,
      surname: pick(people!, row, "surname") || undefined,
      sex: sexOf(pick(people!, row, "sex")) ?? "male",
      living: !(deathDate || /arwah|deceased|meninggal|mati|dead|almarhum|allahyarham/.test(status)),
      birthDate: dateOf(row[people!.col.birthDate ?? -1], warn),
      birthPlace: pick(people!, row, "birthPlace") || undefined,
      deathDate,
      deathPlace: pick(people!, row, "deathPlace") || undefined,
      burialPlace: pick(people!, row, "burialPlace") || undefined,
      religion: pick(people!, row, "religion") || undefined,
      ethnicity: pick(people!, row, "ethnicity") || undefined,
      occupation: pick(people!, row, "occupation") || undefined,
      phone: pick(people!, row, "phone") || undefined,
      notes: pick(people!, row, "notes") || undefined,
      nickname: pick(people!, row, "nickname") || undefined,
      createdAt: now,
      updatedAt: now,
    };
    if (!sexOf(pick(people!, row, "sex"))) sexHint.set(code.toUpperCase(), "male"); // placeholder: decided below
    byCode.set(code.toUpperCase(), p);
    parentCols.push({ child: code.toUpperCase(), father: pick(people!, row, "fatherId").toUpperCase(), mother: pick(people!, row, "motherId").toUpperCase() });
  });
  const unknownSex = new Set(sexHint.keys());
  sexHint.clear();
  const idOf = (code: string) => byCode.get(code.trim().toUpperCase())?.id;

  // ---- Marriages --------------------------------------------------------------------
  const unions: Union[] = [];
  const unionSheet = [sheetNamed(book, [W.bm.sheets.unions, W.en.sheets.unions]), ...book].filter(Boolean) as ReadSheet[];
  let ut: Table<(typeof UNION_KEYS)[number]> | null = null;
  for (const s of unionSheet) if ((ut = findTable(s, UNION_H, ["husbandId", "wifeId"]))) break;
  const order = new Map<string, number>();
  if (ut) {
    for (const row of ut.sheet.rows.slice(ut.head + 1)) {
      if (!row) continue;
      const h = pick(ut, row, "husbandId").toUpperCase();
      const w = pick(ut, row, "wifeId").toUpperCase();
      if (!h && !w) continue;
      const a = idOf(h);
      const b = idOf(w);
      if (!a || !b || a === b) {
        warn();
        continue;
      }
      sexHint.set(h, "male");
      sexHint.set(w, "female");
      const sortOrder = Math.max(order.get(a) ?? 0, order.get(b) ?? 0);
      order.set(a, (order.get(a) ?? 0) + 1);
      order.set(b, (order.get(b) ?? 0) + 1);
      unions.push({
        id: newId(),
        partnerA: a,
        partnerB: b,
        status: statusOf(pick(ut, row, "status")),
        startDate: dateOf(row[ut.col.startDate ?? -1], warn),
        endDate: dateOf(row[ut.col.endDate ?? -1], warn),
        place: pick(ut, row, "place") || undefined,
        notes: pick(ut, row, "notes") || undefined,
        sortOrder,
      });
    }
  }

  // ---- Parent links -------------------------------------------------------------------
  const links: ParentLink[] = [];
  const seen = new Set<string>();
  const addLink = (childCode: string, parentCode: string, kind: LinkKind) => {
    const c = idOf(childCode);
    const p = idOf(parentCode);
    if (!c || !p || c === p) return false;
    if (seen.has(`${p}>${c}`)) return true;
    seen.add(`${p}>${c}`);
    links.push({ id: newId(), parentId: p, childId: c, kind });
    return true;
  };
  const linkSheets = [sheetNamed(book, [W.bm.sheets.links, W.en.sheets.links]), ...book].filter(Boolean) as ReadSheet[];
  let lt: Table<(typeof LINK_KEYS)[number]> | null = null;
  for (const s of linkSheets) if ((lt = findTable(s, LINK_H, ["childId", "parentId"]))) break;
  if (lt) {
    for (const row of lt.sheet.rows.slice(lt.head + 1)) {
      if (!row) continue;
      const c = pick(lt, row, "childId");
      const p = pick(lt, row, "parentId");
      if (!c && !p) continue;
      if (!addLink(c, p, kindOf(pick(lt, row, "kind")))) warn();
      const role = pick(lt, row, "role").toLowerCase();
      if (/^(bapa|father|ayah)$/.test(role)) sexHint.set(p.toUpperCase(), "male");
      if (/^(ibu|mother|emak|mak)$/.test(role)) sexHint.set(p.toUpperCase(), "female");
    }
  }
  // Father / mother typed straight into the people tab also count
  for (const r of parentCols) {
    if (r.father && addLink(r.child, r.father, "birth")) sexHint.set(r.father, "male");
    if (r.mother && addLink(r.child, r.mother, "birth")) sexHint.set(r.mother, "female");
  }
  // Sex left blank: take it from being a husband/wife or father/mother
  for (const code of unknownSex) {
    const hint = sexHint.get(code);
    if (hint) byCode.get(code)!.sex = hint;
  }

  // ---- Photos: Gambar tab (picture next to its ID), or files named by ID ------------------
  const photos: Record<string, string> = {};
  let photoCount = 0;
  const setPhoto = (code: string, data: string, ext: string) => {
    const p = byCode.get(code.trim().toUpperCase()) ?? [...byCode.values()].find((x) => x.id === code.trim());
    if (!p || !data) return;
    const name = `${p.id}-x${Date.now().toString(36)}${photoCount}.${/png/i.test(ext) ? "png" : "jpg"}`;
    photos[name] = data;
    p.photo = name;
    photoCount++;
  };
  const known = (c: string | undefined) => !!c && byCode.has(c.trim().toUpperCase());
  for (const s of book) {
    for (const im of s.images) {
      // The picture's own name is the person's ID (Waris writes it). Spreadsheet apps can
      // nudge a picture's anchor a row up or down, so the row is only a fallback.
      const code = [im.name, text(s.rows[im.row]?.[0]), text(s.rows[im.row + 1]?.[0]), text(s.rows[im.row - 1]?.[0])].find(known);
      if (code) setPhoto(code, toBase64(im.data), im.ext);
    }
  }
  for (const f of opts.images ?? []) setPhoto(f.name.replace(/\.[^.]+$/, ""), f.base64, f.name.split(".").pop() ?? "jpg");

  // Family name from the summary sheet title, unless it's the default heading
  const summary = sheetNamed(book, [W.bm.sheets.summary, W.en.sheets.summary]);
  const title = text(summary?.rows[0]?.[0]);
  const familyName = title && title !== W.bm.summaryTitle && title !== W.en.summaryTitle ? title : "";

  const snapshot: FamilySnapshot = { persons: [...byCode.values()], unions, links, familyName };
  return { parsed: { data: sanitize(snapshot), photos, legacyPhotos: {} }, people: snapshot.persons.length, photos: photoCount, skipped };
}

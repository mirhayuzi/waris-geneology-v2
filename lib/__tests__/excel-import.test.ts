import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFamilyWorkbook } from "../excel-export";
import { excelToBackup } from "../excel-import";
import { FamilyGraph } from "../graph";
import { translate } from "../i18n";
import { mergeSnapshots } from "../merge";
import type { FamilySnapshot, Person } from "../model";
import { buildXlsx, fromBase64, toBase64 } from "../xlsx";
import { readXlsx } from "../xlsx-read";
import { family } from "./fixture";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function richFamily(): FamilySnapshot {
  const s = family();
  const p = (id: string) => s.persons.find((x) => x.id === id)!;
  p("norbidin").prefix = "Haji";
  p("norbidin").deathDate = "1990-05-02";
  p("norbidin").burialPlace = "Tanah Perkuburan Islam Papar";
  p("sibil").birthDate = "~1930";
  p("aishah").birthDate = "1975-03";
  p("mirhayuzi").nickname = "Yuzi";
  p("mirhayuzi").fatherName = "Mohammad";
  p("mirhayuzi").notes = 'Line one\nTom & "Jerry" <b>';
  p("nisa").surname = "Tan";
  s.unions.find((u) => u.id === "u2")!.startDate = "1974-06-01";
  s.unions.find((u) => u.id === "u4")!.status = "divorced";
  s.links.find((l) => l.id === "zaitun>razak")!.kind = "adopted";
  return s;
}

const exportBook = (s: FamilySnapshot, lang: "en" | "bm", withPhotos = true) => {
  const png = fromBase64(PNG);
  const photos = withPhotos ? { mirhayuzi: { data: png, ext: "png" as const, width: 1, height: 1 }, siti: { data: png, ext: "png" as const, width: 1, height: 1 } } : undefined;
  const sheets = buildFamilyWorkbook(new FamilyGraph(s), { lang, t: (k, v) => translate(lang, k, v), homeId: "mirhayuzi", familyName: "Keluarga Test", today: "30/10/2026", photos });
  return buildXlsx(sheets);
};

const FIELDS: (keyof Person)[] = ["id", "givenName", "prefix", "fatherName", "surname", "nickname", "sex", "living", "birthDate", "birthPlace", "deathDate", "deathPlace", "burialPlace", "religion", "ethnicity", "occupation", "phone", "notes"];
const personsOf = (s: FamilySnapshot) => s.persons.map((p) => Object.fromEntries(FIELDS.map((f) => [f, p[f] ?? null]))).sort((a, b) => String(a.id).localeCompare(String(b.id)));
const linksOf = (s: FamilySnapshot) => s.links.map((l) => `${l.parentId}>${l.childId}:${l.kind}`).sort();
const unionsOf = (s: FamilySnapshot) => s.unions.map((u) => `${[u.partnerA, u.partnerB].sort().join("+")}:${u.status}:${u.startDate ?? ""}`).sort();

function expectSameTree(a: FamilySnapshot, b: FamilySnapshot) {
  expect(personsOf(b)).toEqual(personsOf(a));
  expect(linksOf(b)).toEqual(linksOf(a));
  expect(unionsOf(b)).toEqual(unionsOf(a));
}

describe("excel import", () => {
  for (const lang of ["bm", "en"] as const) {
    it(`gives back the same tree and photos (${lang})`, () => {
      const s = richFamily();
      const bytes = exportBook(s, lang);
      if (process.env.XLSX_OUT && lang === "bm") writeFileSync(process.env.XLSX_OUT, bytes);
      const r = excelToBackup(readXlsx(bytes));
      expectSameTree(s, r.parsed.data);
      expect(r.parsed.data.familyName).toBe("Keluarga Test");
      expect(r.skipped).toBe(0);
      // photos come back on the right people
      expect(r.photos).toBe(2);
      const withPhoto = r.parsed.data.persons.filter((p) => p.photo).map((p) => p.id).sort();
      expect(withPhoto).toEqual(["mirhayuzi", "siti"]);
      for (const p of r.parsed.data.persons.filter((x) => x.photo)) expect(r.parsed.photos[p.photo!]).toBe(toBase64(fromBase64(PNG)));
    });
  }

  it("re-importing an unchanged file changes nothing when merged", () => {
    const s = richFamily();
    const r = excelToBackup(readXlsx(exportBook(s, "bm", false)));
    const m = mergeSnapshots(s, r.parsed.data);
    expect([m.added, m.updated]).toEqual([0, 0]);
    expect(m.snapshot.links).toHaveLength(s.links.length);
    expect(m.snapshot.unions).toHaveLength(s.unions.length);
  });

  it("reads people typed into Excel by hand, linked by ID, and photos named by ID", () => {
    const s = richFamily();
    const book = readXlsx(exportBook(s, "bm", false));
    const ahli = book.find((x) => x.name === "Ahli")!;
    const head = ahli.rows[3] as (string | null)[];
    const col = (h: string) => head.findIndex((x) => x?.startsWith(h));
    const meRow = ahli.rows.find((r) => r?.[col("waris_id")] === "mirhayuzi")!;
    const nisaRow = ahli.rows.find((r) => r?.[col("waris_id")] === "nisa")!;
    // A new daughter: no waris_id, father and mother given by their P-codes, sex typed as "P", date as text
    const row: (string | number | null)[] = [];
    row[col("ID")] = "P0200";
    row[col("Nama")] = "Aisyah";
    row[col("bin/binti")] = "Mirhayuzi";
    row[col("Jantina")] = "P";
    row[col("Tarikh lahir")] = "5/6/2021";
    row[col("ID Bapa")] = meRow[0] as string;
    row[col("ID Ibu")] = nisaRow[0] as string;
    ahli.rows.push(row);
    const r = excelToBackup(book, { images: [{ name: "P0200.jpg", base64: PNG }] });
    const g = new FamilyGraph(r.parsed.data);
    const kid = r.parsed.data.persons.find((p) => p.givenName === "Aisyah")!;
    expect(kid.sex).toBe("female");
    expect(kid.birthDate).toBe("2021-06-05");
    expect(g.father(kid.id)?.id).toBe("mirhayuzi");
    expect(g.mother(kid.id)?.id).toBe("nisa");
    expect(kid.photo).toBeTruthy();
    // and merging adds just her
    const m = mergeSnapshots(s, r.parsed.data);
    expect([m.added, m.updated]).toEqual([1, 0]);
  });

  it("rejects a spreadsheet that isn't a Waris family file", () => {
    expect(() => excelToBackup([{ name: "Sheet1", rows: [["a", "b"], [1, 2]], images: [] }])).toThrow("not-waris-excel");
  });

  // Run by hand after re-saving the exported file in LibreOffice (shared strings, new drawing ids)
  it.runIf(!!process.env.XLSX_RESAVED)("reads a file re-saved by another spreadsheet app", () => {
    const r = excelToBackup(readXlsx(new Uint8Array(readFileSync(process.env.XLSX_RESAVED!))));
    expectSameTree(richFamily(), r.parsed.data);
    expect(r.photos).toBe(2);
    expect(r.parsed.data.persons.filter((p) => p.photo).map((p) => p.id).sort()).toEqual(["mirhayuzi", "siti"]);
  });
});

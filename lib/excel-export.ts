import { relationLines } from "../components/relation";
import { formatDate, parseStored } from "./dates";
import type { FamilyGraph } from "./graph";
import type { TKey } from "./i18n";
import { relationText } from "./kinship";
import { fullName, type LinkKind, type Person, type UnionStatus } from "./model";
import { type Cell, colName, type SheetSpec, type StyleName } from "./xlsx";

/**
 * The whole tree as an Excel workbook:
 *  - Panduan        how to read and edit it
 *  - Susur_Galur    the family outline (each generation one column to the right),
 *                   with anak/cucu/cicit/piut counted per branch
 *  - Ringkasan      totals and a look-up by ID
 *  - Ahli           one row per person (the main data)
 *  - Perkahwinan    one row per marriage
 *  - Ibu_Bapa_Anak  one row per parent-child link
 * Names and counts are formulas, so edits in Excel flow through; each formula also
 * carries its current value for viewers that don't calculate.
 */

type T = (key: TKey, vars?: Record<string, string | number>) => string;

export interface ExcelOptions {
  lang: "en" | "bm";
  t: T;
  homeId?: string;
  customTerms?: Record<string, string>;
  familyName?: string;
  /** For the "exported on" line (passed in so tests are stable) */
  today: string;
}

const W = {
  bm: {
    sheets: { guide: "Panduan", outline: "Susur_Galur", summary: "Ringkasan", people: "Ahli", unions: "Perkahwinan", links: "Ibu_Bapa_Anak" },
    gens: ["Asal", "Anak", "Cucu", "Cicit", "Piut", "Piat", "Miut"],
    genN: (n: number) => `Gen. ${n}`,
    sex: { male: "L", female: "P" },
    alive: "Hidup",
    dead: "Arwah",
    status: { married: "kahwin", divorced: "cerai", widowed: "balu/duda" } as Record<UnionStatus, string>,
    kind: { birth: "kandung", adopted: "angkat", step: "tiri", foster: "pelihara", milk: "susuan" } as Record<LinkKind, string>,
    role: { male: "Bapa", female: "Ibu" },
    bin: "bin",
    binti: "binti",
    seeAbove: (p: string) => `(lihat ${p})`,
    outlineTitle: "Susur Galur Keluarga",
    outlineSub: "Setiap generasi satu lajur ke kanan. Bilangan anak, cucu, cicit dan piut setiap cabang dikira sendiri.",
    outlineCols: ["Bil.", "Generasi", "Anak", "Cucu", "Cicit", "Piut", "Jumlah"],
    spouse: "Pasangan",
    born: "Lahir",
    died: "Meninggal",
    peopleTitle: "Ahli Keluarga",
    peopleSub: "Satu baris seorang. Sel kuning boleh diubah; nama penuh, nama ibu bapa dan bilangan anak dikira sendiri.",
    peopleCols: ["ID", "Nama penuh", "Gelaran", "Nama", "bin/binti\n(nama bapa)", "Nama keluarga", "Jantina\n(L/P)", "Status", "Tarikh lahir", "Tempat lahir", "Tarikh meninggal", "Tempat meninggal", "Tempat kubur", "ID Bapa", "Nama bapa", "ID Ibu", "Nama ibu", "Pasangan", "Bil. anak", "Jumlah keturunan", "HUBUNGAN", "Agama", "Bangsa", "Pekerjaan", "Telefon", "Catatan", "waris_id"],
    relationTo: (n: string) => `Hubungan dengan ${n}`,
    unionsTitle: "Perkahwinan",
    unionsSub: "Satu baris satu perkahwinan. Kahwin lebih sekali = lebih dari satu baris.",
    unionsCols: ["ID", "ID Suami", "Nama suami", "ID Isteri", "Nama isteri", "Status", "Tarikh kahwin", "Tarikh tamat", "Tempat", "Catatan"],
    linksTitle: "Ibu Bapa – Anak",
    linksSub: "Satu baris setiap ibu atau bapa kepada seorang anak. Inilah yang menyambung salasilah.",
    linksCols: ["ID", "ID Anak", "Nama anak", "ID Ibu/Bapa", "Nama ibu/bapa", "Peranan", "Hubungan"],
    summaryTitle: "Ringkasan Keluarga",
    exported: (d: string) => `Dieksport daripada aplikasi Waris pada ${d}`,
    members: "AHLI",
    total: "Jumlah ahli",
    male: "Lelaki",
    female: "Perempuan",
    living: "Masih hidup",
    deceased: "Arwah",
    descTitle: "KETURUNAN",
    descCols: ["Keluarga", "Anak", "Cucu", "Cicit", "Piut", "Jumlah"],
    marriages: "PERKAHWINAN",
    marriagesTotal: "Jumlah perkahwinan",
    childLinks: "HUBUNGAN ANAK",
    lookup: "CARI AHLI",
    typeId: "Taip ID:",
    fullName: "Nama penuh",
    father: "Bapa",
    mother: "Ibu",
    children: "Bilangan anak",
    notFound: "Tiada",
    guideTitle: "Panduan — Salasilah Waris",
    guideSub: "Fail ini dibuat oleh aplikasi Waris. Ia boleh dibuka di Excel, Google Sheets atau WPS.",
    guide: [
      ["TAB", ""],
      ["Susur_Galur", "Salasilah tersusun: setiap generasi satu lajur ke kanan, bernombor 1, 1.1, 1.1.2 ... Bilangan anak, cucu, cicit, piut setiap cabang dikira sendiri."],
      ["Ringkasan", "Jumlah ahli, keturunan setiap keluarga, perkahwinan, dan carian ahli ikut ID."],
      ["Ahli", "Satu baris seorang — data utama. Nama penuh dengan bin/binti dibina sendiri."],
      ["Perkahwinan", "Satu baris satu perkahwinan. Kahwin semula = baris baharu."],
      ["Ibu_Bapa_Anak", "Satu baris setiap ibu atau bapa kepada anak. Inilah yang menyambung salasilah."],
      ["", ""],
      ["KOD", ""],
      ["ID", "P0001 ahli · M0001 perkahwinan · R0001 hubungan anak. Jangan ubah ID yang sudah dipakai."],
      ["Jantina", "L = lelaki, P = perempuan"],
      ["Status perkahwinan", "kahwin / cerai / balu/duda"],
      ["Hubungan anak", "kandung / angkat / tiri / pelihara / susuan"],
      ["Tarikh", "Tarikh penuh ditulis 14/03/1958. Tarikh tidak lengkap ditulis seperti 1958 atau ~1950 (anggaran)."],
      ["", ""],
      ["WARNA", ""],
      ["Sel kuning", "Boleh diisi atau diubah."],
      ["Sel putih", "Dikira sendiri (formula) — jangan taip di situ."],
      ["Teks kelabu", "Arwah."],
      ["waris_id", "Lajur tersembunyi di tab Ahli, untuk aplikasi Waris. Jangan ubah."],
    ],
  },
  en: {
    sheets: { guide: "Guide", outline: "Family_Outline", summary: "Summary", people: "People", unions: "Marriages", links: "Parents_Children" },
    gens: ["Root", "Children", "Grandchildren", "Great-grandch.", "2x great-gr.", "3x great-gr.", "4x great-gr."],
    genN: (n: number) => `Gen. ${n}`,
    sex: { male: "M", female: "F" },
    alive: "Living",
    dead: "Deceased",
    status: { married: "married", divorced: "divorced", widowed: "widowed" } as Record<UnionStatus, string>,
    kind: { birth: "birth", adopted: "adopted", step: "step", foster: "foster", milk: "milk" } as Record<LinkKind, string>,
    role: { male: "Father", female: "Mother" },
    bin: "bin",
    binti: "binti",
    seeAbove: (p: string) => `(see ${p})`,
    outlineTitle: "Family Outline",
    outlineSub: "Each generation one column to the right. Children, grandchildren and further descendants are counted for every branch.",
    outlineCols: ["No.", "Generation", "Child.", "Grandch.", "Gr-gr.", "2x gr.", "Total"],
    spouse: "Spouse",
    born: "Born",
    died: "Died",
    peopleTitle: "Family Members",
    peopleSub: "One row per person. Yellow cells can be edited; full names, parent names and child counts are worked out.",
    peopleCols: ["ID", "Full name", "Title", "Name", "bin/binti\n(father's name)", "Family name", "Sex\n(M/F)", "Status", "Born", "Birthplace", "Died", "Place of death", "Burial place", "Father ID", "Father", "Mother ID", "Mother", "Spouse", "Children", "Descendants", "RELATION", "Religion", "Ethnicity", "Occupation", "Phone", "Notes", "waris_id"],
    relationTo: (n: string) => `Relation to ${n}`,
    unionsTitle: "Marriages",
    unionsSub: "One row per marriage. Someone married more than once has more than one row.",
    unionsCols: ["ID", "Husband ID", "Husband", "Wife ID", "Wife", "Status", "Married", "Ended", "Place", "Notes"],
    linksTitle: "Parents – Children",
    linksSub: "One row for each parent of each child. These rows connect the family tree.",
    linksCols: ["ID", "Child ID", "Child", "Parent ID", "Parent", "Role", "Link"],
    summaryTitle: "Family Summary",
    exported: (d: string) => `Exported from the Waris app on ${d}`,
    members: "MEMBERS",
    total: "Total people",
    male: "Male",
    female: "Female",
    living: "Living",
    deceased: "Deceased",
    descTitle: "DESCENDANTS",
    descCols: ["Family", "Children", "Grandch.", "Gr-grandch.", "2x great", "Total"],
    marriages: "MARRIAGES",
    marriagesTotal: "Total marriages",
    childLinks: "PARENT LINKS",
    lookup: "LOOK UP",
    typeId: "Type an ID:",
    fullName: "Full name",
    father: "Father",
    mother: "Mother",
    children: "Children",
    notFound: "Not found",
    guideTitle: "Guide — Waris Family Tree",
    guideSub: "Made by the Waris app. Opens in Excel, Google Sheets or WPS.",
    guide: [
      ["SHEETS", ""],
      ["Family_Outline", "The family laid out by generation, one column to the right per generation, numbered 1, 1.1, 1.1.2 ... Descendants are counted for every branch."],
      ["Summary", "Totals, descendants of each family, marriages, and a look-up by ID."],
      ["People", "One row per person — the main data. Full names with bin/binti are built for you."],
      ["Marriages", "One row per marriage. Remarriage = another row."],
      ["Parents_Children", "One row for each parent of each child. These connect the tree."],
      ["", ""],
      ["CODES", ""],
      ["ID", "P0001 person · M0001 marriage · R0001 parent link. Don't change IDs already in use."],
      ["Sex", "M = male, F = female"],
      ["Marriage status", "married / divorced / widowed"],
      ["Child link", "birth / adopted / step / foster / milk"],
      ["Dates", "Full dates as 14/03/1958. Partial dates as 1958, or ~1950 when approximate."],
      ["", ""],
      ["COLOURS", ""],
      ["Yellow cells", "Can be filled in or changed."],
      ["White cells", "Worked out by formulas — don't type there."],
      ["Grey text", "Deceased."],
      ["waris_id", "Hidden column in People, used by the Waris app. Don't change it."],
    ],
  },
};

const FIRST = 5; // first data row (row 4 is the header)
const SPARE = 500; // formulas reach this far past the data, so rows added in Excel are included

/** A stored date as an Excel date when complete, otherwise as text ("1982", "~1950"). */
function dateCell(v: string | undefined, lang: "en" | "bm", style: StyleName = "date"): Cell {
  const d = parseStored(v);
  if (!d) return { value: v ?? null, style: style === "inputDate" ? "input" : "text" };
  if (d.month && d.day && !d.approx) return { value: { date: [d.year, d.month, d.day] }, style };
  return { value: formatDate(v, lang), style: style === "inputDate" ? "input" : "text" };
}

export function buildFamilyWorkbook(graph: FamilyGraph, o: ExcelOptions): SheetSpec[] {
  const w = W[o.lang];
  const S = w.sheets;
  const persons = [...graph.persons.values()];
  const home = graph.get(o.homeId);

  // ---- outline order: each family line from its top ancestor -------------------------
  const roots = persons
    .filter((p) => graph.parentLinksOf(p.id).length === 0)
    // Someone who only married into the family is shown beside their spouse, not as a root:
    // they have a spouse from the family, and all their children are that spouse's children too
    .filter((p) => {
      const inFamily = graph.partners(p.id).filter((q) => graph.parentLinksOf(q.id).length > 0);
      if (!inFamily.length) return true;
      return graph.children(p.id).some((c) => !inFamily.some((q) => graph.parentLinksOf(c.id).some((l) => l.parentId === q.id)));
    })
    .map((p) => ({ p, size: graph.descendantsByGeneration(p.id, { includeNonBirth: true }).reduce((n, g) => n + g.length, 0) }))
    .sort((a, b) => b.size - a.size || (a.p.birthDate ?? "9999").localeCompare(b.p.birthDate ?? "9999"))
    .map((x) => x.p);
  type OutlineRow = { p: Person; depth: number; path: string; repeat?: string; end: number; root: number };
  const outline: OutlineRow[] = [];
  const covered = new Set<string>();
  roots.forEach((r) => {
    if (covered.has(r.id)) return; // already shown as a spouse of an earlier root
    for (const q of graph.partners(r.id)) if (roots.includes(q)) covered.add(q.id);
    covered.add(r.id);
    const rootIndex = outline.length;
    // Each family line is listed in full; only a repeat inside the same line (cousin
    // marriage) points back instead of repeating the branch, so counts stay right
    const firstPath = new Map<string, string>();
    const walk = (p: Person, depth: number, path: string) => {
      const row: OutlineRow = { p, depth, path, end: 0, root: rootIndex };
      outline.push(row);
      if (firstPath.has(p.id)) {
        // reached twice (cousin marriage): point back instead of repeating the branch
        row.repeat = firstPath.get(p.id);
      } else {
        firstPath.set(p.id, path || "—");
        graph.children(p.id).forEach((c, i) => walk(c, depth + 1, path ? `${path}.${i + 1}` : String(i + 1)));
      }
      row.end = outline.length; // exclusive
    };
    walk(r, 0, "");
  });

  // ---- IDs: outline order first, then anyone not reached (e.g. spouses) --------------
  const pid = new Map<string, string>();
  for (const row of outline) if (!pid.has(row.p.id)) pid.set(row.p.id, `P${String(pid.size + 1).padStart(4, "0")}`);
  for (const p of persons) if (!pid.has(p.id)) pid.set(p.id, `P${String(pid.size + 1).padStart(4, "0")}`);
  const peopleOrder = [...pid.keys()].map((id) => graph.get(id)!);
  const unions = [...graph.snapshot.unions].filter((u) => graph.get(u.partnerA) && graph.get(u.partnerB));
  const mid = new Map(unions.map((u, i) => [u.id, `M${String(i + 1).padStart(4, "0")}`]));
  const links = [...graph.snapshot.links]
    .filter((l) => graph.get(l.parentId) && graph.get(l.childId))
    .sort((a, b) => pid.get(a.childId)!.localeCompare(pid.get(b.childId)!) || (graph.get(a.parentId)!.sex === "male" ? -1 : 1));

  const lastPerson = FIRST + peopleOrder.length - 1;
  const pRange = (col: string) => `${S.people}!$${col}$${FIRST}:$${col}$${lastPerson + SPARE}`;
  const nameOf = (idCell: string, id: string | undefined) => ({
    f: `IFERROR(INDEX(${pRange("B")},MATCH(${idCell},${pRange("A")},0)),"")`,
    v: id ? fullName(graph.get(id)!) : "",
  });
  const head = (title: string, sub: string): Cell[][] => [[{ value: title, style: "title" }], [{ value: sub, style: "muted" }], []];
  const header = (cols: string[]): Cell[] => cols.map((c) => ({ value: c, style: "header" }));
  const descTotal = (id: string) => graph.descendantsByGeneration(id).reduce((n, g) => n + g.length, 0);

  // ---- Ahli / People --------------------------------------------------------------
  const linksSheetLast = FIRST + links.length - 1;
  const lRange = (col: string) => `${S.links}!$${col}$${FIRST}:$${col}$${linksSheetLast + SPARE}`;
  const relCol = w.relationTo(home?.givenName ?? "");
  const peopleRows: Cell[][] = [...head(w.peopleTitle, w.peopleSub), header(w.peopleCols.map((c) => (c === "HUBUNGAN" || c === "RELATION" ? relCol : c)))];
  peopleOrder.forEach((p, i) => {
    const r = FIRST + i;
    const f = graph.father(p.id);
    const m = graph.mother(p.id);
    const dead = !p.living;
    const txt: StyleName = dead ? "dead" : "text";
    const rel = home && home.id !== p.id ? relationText(graph, home.id, p.id, o.customTerms) : null;
    const sexCode = w.sex[p.sex];
    peopleRows.push([
      { value: pid.get(p.id), style: txt },
      {
        value: {
          f: `TRIM(C${r}&" "&D${r}&IF(E${r}="",""," "&IF(G${r}="${w.sex.female}","${w.binti}","${w.bin}")&" "&E${r})&IF(F${r}="",""," "&F${r}))`,
          v: fullName(p),
        },
        style: dead ? "dead" : "bold",
      },
      { value: p.prefix, style: "input" },
      { value: p.givenName, style: "input" },
      { value: p.fatherName, style: "input" },
      { value: p.surname, style: "input" },
      { value: sexCode, style: "input" },
      { value: dead ? w.dead : w.alive, style: "input" },
      dateCell(p.birthDate, o.lang, "inputDate"),
      { value: p.birthPlace, style: "input" },
      dateCell(p.deathDate, o.lang, "inputDate"),
      { value: p.deathPlace, style: "input" },
      { value: p.burialPlace, style: "input" },
      { value: f ? pid.get(f.id) : null, style: "input" },
      { value: nameOf(`N${r}`, f?.id), style: txt },
      { value: m ? pid.get(m.id) : null, style: "input" },
      { value: nameOf(`P${r}`, m?.id), style: txt },
      { value: graph.partners(p.id).map((q) => fullName(q)).join("; "), style: txt },
      { value: { f: `COUNTIF(${lRange("D")},A${r})`, v: graph.childLinksOf(p.id).length }, style: "num" },
      { value: descTotal(p.id) || null, style: "num" },
      { value: p.id === home?.id ? "—" : rel ? relationLines(rel, o.lang, o.t).main : "", style: txt },
      { value: p.religion, style: "input" },
      { value: p.ethnicity, style: "input" },
      { value: p.occupation, style: "input" },
      { value: p.phone, style: "input" },
      { value: p.notes, style: "input" },
      { value: p.id, style: "muted" },
    ]);
  });
  const peopleSheet: SheetSpec = {
    name: S.people,
    rows: peopleRows,
    cols: [9, 32, 10, 20, 18, 12, 8, 9, 12, 14, 12, 14, 14, 9, 28, 9, 28, 30, 7, 10, 26, 10, 10, 14, 13, 28, 12].map((width, i) => ({ width, hidden: i === 26 })),
    freeze: { rows: 4, cols: 2 },
    autoFilter: `A4:${colName(25)}${lastPerson}`,
    lists: [
      { sqref: `G${FIRST}:G${lastPerson + SPARE}`, values: [w.sex.male, w.sex.female] },
      { sqref: `H${FIRST}:H${lastPerson + SPARE}`, values: [w.alive, w.dead] },
    ],
    rowHeights: { 4: 30 },
    tabColor: "8FBFA5",
  };

  // ---- Perkahwinan / Marriages -----------------------------------------------------
  const unionRows: Cell[][] = [...head(w.unionsTitle, w.unionsSub), header(w.unionsCols)];
  unions.forEach((u, i) => {
    const r = FIRST + i;
    const a = graph.get(u.partnerA)!;
    const [hus, wife] = a.sex === "male" ? [u.partnerA, u.partnerB] : [u.partnerB, u.partnerA];
    unionRows.push([
      { value: mid.get(u.id), style: "text" },
      { value: pid.get(hus), style: "input" },
      { value: nameOf(`B${r}`, hus), style: "text" },
      { value: pid.get(wife), style: "input" },
      { value: nameOf(`D${r}`, wife), style: "text" },
      { value: w.status[u.status], style: "input" },
      dateCell(u.startDate, o.lang, "inputDate"),
      dateCell(u.endDate, o.lang, "inputDate"),
      { value: u.place, style: "input" },
      { value: u.notes, style: "input" },
    ]);
  });
  const lastUnion = FIRST + unions.length - 1;
  const unionSheet: SheetSpec = {
    name: S.unions,
    rows: unionRows,
    cols: [9, 10, 32, 10, 32, 11, 13, 13, 16, 28].map((width) => ({ width })),
    freeze: { rows: 4 },
    lists: [{ sqref: `F${FIRST}:F${lastUnion + SPARE}`, values: Object.values(w.status) }],
    rowHeights: { 4: 30 },
    tabColor: "8FBFA5",
  };

  // ---- Ibu_Bapa_Anak / Parents_Children ----------------------------------------------
  const linkRows: Cell[][] = [...head(w.linksTitle, w.linksSub), header(w.linksCols)];
  links.forEach((l, i) => {
    const r = FIRST + i;
    const parent = graph.get(l.parentId)!;
    linkRows.push([
      { value: `R${String(i + 1).padStart(4, "0")}`, style: "text" },
      { value: pid.get(l.childId), style: "input" },
      { value: nameOf(`B${r}`, l.childId), style: "text" },
      { value: pid.get(l.parentId), style: "input" },
      { value: nameOf(`D${r}`, l.parentId), style: "text" },
      {
        value: { f: `IFERROR(IF(INDEX(${pRange("G")},MATCH(D${r},${pRange("A")},0))="${w.sex.female}","${w.role.female}","${w.role.male}"),"")`, v: w.role[parent.sex] },
        style: "text",
      },
      { value: w.kind[l.kind], style: "input" },
    ]);
  });
  const linkSheet: SheetSpec = {
    name: S.links,
    rows: linkRows,
    cols: [9, 10, 32, 11, 32, 9, 11].map((width) => ({ width })),
    freeze: { rows: 4 },
    lists: [{ sqref: `G${FIRST}:G${linksSheetLast + SPARE}`, values: Object.values(w.kind) }],
    rowHeights: { 4: 30 },
    tabColor: "8FBFA5",
  };

  // ---- Susur_Galur / Family_Outline ---------------------------------------------------
  const maxDepth = Math.max(0, ...outline.map((x) => x.depth));
  const nameCols = maxDepth + 1;
  const C = {
    count0: 2, // C..F anak, cucu, cicit, piut
    total: 6,
    name0: 7,
    spouse: 7 + nameCols,
    born: 8 + nameCols,
    died: 9 + nameCols,
    id: 10 + nameCols,
    gen: 11 + nameCols, // hidden helper: generation number for the counts
  };
  const genLabel = (d: number) => w.gens[d] ?? w.genN(d);
  const oHeader = [...w.outlineCols, ...Array.from({ length: nameCols }, (_, d) => genLabel(d)), w.spouse, w.born, w.died, "ID", "gen"];
  const outlineRows: Cell[][] = [...head(w.outlineTitle, w.outlineSub), header(oHeader)];
  outline.forEach((row, k) => {
    const r = FIRST + k;
    const p = row.p;
    const below = outline.slice(k + 1, row.end);
    const last = FIRST + row.end - 1;
    const genCol = colName(C.gen);
    const style: StyleName = !p.living ? "dead" : row.depth === 0 ? "gen1" : row.depth === 1 ? "gen2" : "text";
    const fill: StyleName = row.depth === 0 ? "gen1Plain" : "text";
    const cells: Cell[] = Array.from({ length: C.gen + 1 }, () => ({ value: null, style: fill }));
    cells[0] = { value: row.path || "—", style: row.depth === 0 ? "gen1Plain" : "muted" };
    cells[1] = { value: genLabel(row.depth), style: row.depth === 0 ? "gen1Plain" : "muted" };
    if (below.length && !row.repeat) {
      for (let d = 1; d <= 4; d++) {
        const n = below.filter((x) => !x.repeat && x.depth === row.depth + d).length;
        const range = `${genCol}${r + 1}:${genCol}${last}`;
        cells[C.count0 + d - 1] = { value: { f: `IF(COUNTIF(${range},${row.depth + d})=0,"",COUNTIF(${range},${row.depth + d}))`, v: n || "" }, style: "num" };
      }
      cells[C.total] = { value: { f: `COUNTIF(${genCol}${r + 1}:${genCol}${last},">${row.depth}")`, v: below.filter((x) => !x.repeat).length }, style: "numBold" };
    }
    const nm = nameOf(colName(C.id) + r, p.id);
    cells[C.name0 + row.depth] = { value: row.repeat ? { f: `${nm.f}&" ${w.seeAbove(row.repeat)}"`, v: `${nm.v} ${w.seeAbove(row.repeat)}` } : nm, style };
    cells[C.spouse] = { value: graph.partners(p.id).map((q) => fullName(q)).join("; "), style: p.living ? fill : "dead" };
    cells[C.born] = dateCell(p.birthDate, o.lang);
    cells[C.died] = p.living ? { value: null, style: fill } : p.deathDate ? dateCell(p.deathDate, o.lang) : { value: "✿", style: "dead" };
    cells[C.id] = { value: pid.get(p.id), style: "muted" };
    cells[C.gen] = { value: row.repeat ? null : row.depth, style: "text" };
    outlineRows.push(cells);
  });
  const outlineSheet: SheetSpec = {
    name: S.outline,
    rows: outlineRows,
    cols: [
      ...[9, 11, 6, 7, 6, 6, 7].map((width) => ({ width })),
      ...Array.from({ length: nameCols }, (_, d) => ({ width: d === nameCols - 1 ? 34 : 4 })),
      { width: 34 },
      { width: 11 },
      { width: 11 },
      { width: 8 },
      { width: 4, hidden: true },
    ],
    freeze: { rows: 4 },
    rowHeights: { 4: 30 },
    tabColor: "1B6B4A",
  };

  // ---- Ringkasan / Summary ----------------------------------------------------------
  const sum: Cell[][] = [[{ value: o.familyName || w.summaryTitle, style: "title" }], [{ value: w.exported(o.today), style: "muted" }], []];
  const pr = (col: string) => pRange(col);
  const count = (label: string, f: string, v: number) => sum.push([{ value: label, style: "text" }, { value: { f, v }, style: "numBold" }]);
  sum.push([{ value: w.members, style: "section" }]);
  count(w.total, `COUNTA(${pr("A")})`, persons.length);
  count(w.male, `COUNTIF(${pr("G")},"${w.sex.male}")`, persons.filter((p) => p.sex === "male").length);
  count(w.female, `COUNTIF(${pr("G")},"${w.sex.female}")`, persons.filter((p) => p.sex === "female").length);
  count(w.living, `COUNTIF(${pr("H")},"${w.alive}")`, persons.filter((p) => p.living).length);
  count(w.deceased, `COUNTIF(${pr("H")},"${w.dead}")`, persons.filter((p) => !p.living).length);
  sum.push([]);
  // Descendants of each family line, read from that line's top row in the outline
  sum.push([{ value: w.descTitle, style: "section" }]);
  sum.push(header(w.descCols));
  outline.forEach((row, k) => {
    if (row.depth !== 0 || row.end - k < 2) return;
    const r = FIRST + k;
    const cell = (c: number) => `${S.outline}!${colName(c)}${r}`;
    const below = outline.slice(k + 1, row.end).filter((x) => !x.repeat);
    sum.push([
      { value: { f: `${cell(C.name0)}`, v: fullName(row.p) }, style: "bold" },
      ...[1, 2, 3, 4].map((d) => ({ value: { f: `N(${cell(C.count0 + d - 1)})`, v: below.filter((x) => x.depth === d).length }, style: "num" as StyleName })),
      { value: { f: `N(${cell(C.total)})`, v: below.length }, style: "numBold" },
    ]);
  });
  sum.push([]);
  sum.push([{ value: w.marriages, style: "section" }]);
  const uRange = `${S.unions}!$F$${FIRST}:$F$${lastUnion + SPARE}`;
  count(w.marriagesTotal, `COUNTA(${S.unions}!$A$${FIRST}:$A$${lastUnion + SPARE})`, unions.length);
  for (const st of ["married", "divorced", "widowed"] as UnionStatus[]) count(w.status[st], `COUNTIF(${uRange},"${w.status[st]}")`, unions.filter((u) => u.status === st).length);
  sum.push([]);
  sum.push([{ value: w.childLinks, style: "section" }]);
  for (const kd of ["birth", "adopted", "step", "foster", "milk"] as LinkKind[]) count(w.kind[kd], `COUNTIF(${lRange("G")},"${w.kind[kd]}")`, links.filter((l) => l.kind === kd).length);
  sum.push([]);
  sum.push([{ value: w.lookup, style: "section" }]);
  const lookRow = sum.length + 1;
  const firstId = (home && pid.get(home.id)) ?? pid.values().next().value ?? "";
  sum.push([{ value: w.typeId, style: "bold" }, { value: firstId, style: "input" }]);
  const lookup = (label: string, col: string, v: string | number) =>
    sum.push([{ value: label, style: "text" }, { value: { f: `IFERROR(INDEX(${pr(col)},MATCH($B$${lookRow},${pr("A")},0)),"${w.notFound}")`, v }, style: "bold" }]);
  const lp = graph.get([...pid.entries()].find(([, v]) => v === firstId)?.[0]);
  lookup(w.fullName, "B", lp ? fullName(lp) : w.notFound);
  lookup(w.father, "O", lp && graph.father(lp.id) ? fullName(graph.father(lp.id)!) : "");
  lookup(w.mother, "Q", lp && graph.mother(lp.id) ? fullName(graph.mother(lp.id)!) : "");
  lookup(w.spouse, "R", lp ? graph.partners(lp.id).map((q) => fullName(q)).join("; ") : "");
  lookup(w.children, "S", lp ? graph.childLinksOf(lp.id).length : 0);
  const summarySheet: SheetSpec = { name: S.summary, rows: sum, cols: [30, 34, 12, 12, 12, 12].map((width) => ({ width })), tabColor: "1B6B4A" };

  // ---- Panduan / Guide --------------------------------------------------------------
  const guide: Cell[][] = [...head(w.guideTitle, w.guideSub)];
  for (const [a, b] of w.guide) guide.push(b ? [{ value: a, style: a === "Sel kuning" || a === "Yellow cells" ? "input" : "bold" }, { value: b, style: "wrap" }] : a ? [{ value: a, style: "section" }] : []);
  const guideSheet: SheetSpec = { name: S.guide, rows: guide, cols: [{ width: 22 }, { width: 95 }], tabColor: "8FBFA5" };

  return [guideSheet, outlineSheet, summarySheet, peopleSheet, unionSheet, linkSheet];
}

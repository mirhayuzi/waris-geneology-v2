import { strFromU8, unzipSync } from "fflate";

/**
 * Small .xlsx reader: cell values of every sheet, plus pictures and the cell each
 * one sits in. Handles files saved by Excel, Google Sheets, WPS and LibreOffice
 * (shared strings, inline strings, formulas with cached values).
 */

export type CellValue = string | number | boolean | null;

export interface ReadSheet {
  name: string;
  /** rows[r][c], 0-based; missing cells are undefined */
  rows: CellValue[][];
  images: ReadImage[];
}

export interface ReadImage {
  row: number;
  col: number;
  /** Picture name stored in the file (Waris writes the person's ID) */
  name?: string;
  data: Uint8Array;
  ext: string;
}

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    // Excel's escape for characters XML can't hold, e.g. _x000D_
    .replace(/_x([0-9a-f]{4})_/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = decode(m[3] ?? m[4] ?? "");
  return out;
}

/** All text in <t> elements, skipping phonetic hints (<rPh>). */
const textOf = (xml: string) =>
  [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => decode(m[1])).join("");

/** "AB12" -> { col: 27, row: 11 } */
function refToRC(ref: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: +m[2] - 1, col: col - 1 };
}

/** Resolves a relationship target against the folder of the part that points to it. */
function resolve(from: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = from.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function relsOf(get: (path: string) => Uint8Array | undefined, part: string): Map<string, string> {
  const dir = part.split("/").slice(0, -1).join("/");
  const file = get(`${dir ? dir + "/" : ""}_rels/${part.split("/").pop()}.rels`);
  const out = new Map<string, string>();
  if (!file) return out;
  for (const m of strFromU8(file).matchAll(/<Relationship\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (a.Id && a.Target && a.TargetMode !== "External") out.set(a.Id, resolve(part, a.Target));
  }
  return out;
}

export function readXlsx(bytes: Uint8Array): ReadSheet[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("not-xlsx");
  }
  // Part names are case-insensitive in the package format
  const lower = new Map(Object.keys(files).map((k) => [k.toLowerCase(), k]));
  const get = (path: string): Uint8Array | undefined => files[lower.get(path.toLowerCase()) ?? path];
  const wbPath = "xl/workbook.xml";
  if (!get(wbPath)) throw new Error("not-xlsx");

  const shared: string[] = [];
  const sst = get("xl/sharedStrings.xml");
  if (sst) for (const m of strFromU8(sst).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g)) shared.push(m[1] ? textOf(m[1]) : "");

  const wbRels = relsOf(get, wbPath);
  const sheets: ReadSheet[] = [];
  for (const m of strFromU8(get(wbPath)!).matchAll(/<sheet\b[^>]*\/?>/g)) {
    const a = attrs(m[0]);
    const path = wbRels.get(a["r:id"] ?? Object.entries(a).find(([k]) => k.endsWith(":id"))?.[1] ?? "");
    if (!path || !get(path)) continue;
    const xml = strFromU8(get(path)!);
    const rows: CellValue[][] = [];
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(c[1]);
      const rc = ca.r ? refToRC(ca.r) : null;
      if (!rc) continue;
      const inner = c[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value: CellValue = null;
      switch (ca.t) {
        case "s":
          value = v !== undefined ? (shared[+v] ?? null) : null;
          break;
        case "inlineStr":
          value = textOf(inner);
          break;
        case "str":
          value = v !== undefined ? decode(v) : null;
          break;
        case "b":
          value = v === "1";
          break;
        case "e":
          value = null;
          break;
        default:
          value = v !== undefined && v !== "" ? Number(v) : null;
      }
      (rows[rc.row] ??= [])[rc.col] = value;
    }

    // Pictures: sheet -> drawing -> image files, each anchored at a cell
    const images: ReadImage[] = [];
    for (const target of relsOf(get, path).values()) {
      if (!/drawings\/[^/]+\.xml$/i.test(target) || !get(target)) continue;
      const media = relsOf(get, target);
      const dxml = strFromU8(get(target)!);
      for (const an of dxml.matchAll(/<(?:\w+:)?(oneCellAnchor|twoCellAnchor)\b[\s\S]*?<\/(?:\w+:)?\1>/g)) {
        const body = an[0];
        const from = /<(?:\w+:)?from>([\s\S]*?)<\/(?:\w+:)?from>/.exec(body)?.[1] ?? "";
        const col = +(/<(?:\w+:)?col>(\d+)</.exec(from)?.[1] ?? NaN);
        const row = +(/<(?:\w+:)?row>(\d+)</.exec(from)?.[1] ?? NaN);
        const embed = /<a:blip\b[^>]*\br:embed="([^"]+)"/.exec(body)?.[1];
        const file = embed ? media.get(embed) : undefined;
        if (!file || !get(file) || Number.isNaN(col) || Number.isNaN(row)) continue;
        const nameAttr = /<(?:\w+:)?cNvPr\b[^>]*>/.exec(body)?.[0];
        images.push({ row, col, name: nameAttr ? attrs(nameAttr).name : undefined, data: get(file)!, ext: (file.split(".").pop() ?? "jpeg").toLowerCase() });
      }
    }
    sheets.push({ name: a.name ?? `Sheet${sheets.length + 1}`, rows, images });
  }
  return sheets;
}

/** True when the bytes look like a zip (xlsx) file. */
export const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b;

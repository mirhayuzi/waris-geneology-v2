import { strToU8, zipSync } from "fflate";

/**
 * Minimal .xlsx writer: inline strings, numbers, dates, formulas (with the value
 * already worked out, so phone viewers that don't calculate still show it), a fixed
 * set of styles, column widths, frozen header, filter and drop-down lists.
 */

export type Formula = { f: string; v?: string | number };
export type DateCell = { date: [number, number, number] };
export type Value = string | number | null | undefined | Formula | DateCell;
export type StyleName = keyof typeof STYLES;
export type Cell = Value | { value: Value; style: StyleName };
export type Row = Cell[];

export interface SheetSpec {
  name: string;
  rows: Row[];
  /** Width in characters per column; `hidden` hides a helper column */
  cols?: { width: number; hidden?: boolean }[];
  /** Rows above / columns left of this cell stay put (1-based row, 0-based col count) */
  freeze?: { rows: number; cols?: number };
  autoFilter?: string;
  lists?: { sqref: string; values: string[] }[];
  tabColor?: string;
  rowHeights?: Record<number, number>;
}

// ---- styles -------------------------------------------------------------------------
const GREEN = "FF1B6B4A";
const FONTS = [
  `<font><sz val="10"/><name val="Arial"/></font>`, // 0 normal
  `<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>`, // 1 header
  `<font><b/><sz val="16"/><color rgb="${GREEN}"/><name val="Arial"/></font>`, // 2 title
  `<font><i/><sz val="9"/><color rgb="FF666666"/><name val="Arial"/></font>`, // 3 muted
  `<font><b/><sz val="10"/><name val="Arial"/></font>`, // 4 bold
  `<font><sz val="10"/><color rgb="FF808080"/><name val="Arial"/></font>`, // 5 deceased
  `<font><b/><sz val="11"/><color rgb="${GREEN}"/><name val="Arial"/></font>`, // 6 section / gen 1
  `<font><b/><sz val="10"/><color rgb="${GREEN}"/><name val="Arial"/></font>`, // 7 gen 2
];
const FILLS = [
  `<fill><patternFill patternType="none"/></fill>`,
  `<fill><patternFill patternType="gray125"/></fill>`,
  `<fill><patternFill patternType="solid"><fgColor rgb="${GREEN}"/><bgColor indexed="64"/></patternFill></fill>`, // 2 header
  `<fill><patternFill patternType="solid"><fgColor rgb="FFEAF3EE"/><bgColor indexed="64"/></patternFill></fill>`, // 3 light green
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFFF8DC"/><bgColor indexed="64"/></patternFill></fill>`, // 4 input
];
const BORDERS = [`<border><left/><right/><top/><bottom/><diagonal/></border>`, `<border><left/><right/><top/><bottom style="thin"><color rgb="FFD5D5D5"/></bottom><diagonal/></border>`];

interface Xf {
  font: number;
  fill?: number;
  border?: number;
  date?: boolean;
  wrap?: boolean;
  right?: boolean;
}
const STYLES = {
  plain: { font: 0 },
  header: { font: 1, fill: 2, wrap: true },
  title: { font: 2 },
  muted: { font: 3 },
  section: { font: 6 },
  text: { font: 0, border: 1 },
  bold: { font: 4, border: 1 },
  date: { font: 0, border: 1, date: true },
  input: { font: 0, fill: 4, border: 1 },
  inputDate: { font: 0, fill: 4, border: 1, date: true },
  dead: { font: 5, border: 1 },
  gen1: { font: 6, fill: 3, border: 1 },
  gen1Plain: { font: 0, fill: 3, border: 1 },
  gen2: { font: 7, border: 1 },
  num: { font: 0, border: 1, right: true },
  numBold: { font: 4, border: 1, right: true },
  wrap: { font: 0, wrap: true },
} satisfies Record<string, Xf>;
const STYLE_IDS = Object.keys(STYLES) as StyleName[];

function stylesXml(): string {
  const xfs = STYLE_IDS.map((k) => {
    const x: Xf = STYLES[k];
    const align = x.wrap || x.right ? `<alignment${x.wrap ? ' wrapText="1" vertical="top"' : ""}${x.right ? ' horizontal="right"' : ""}/>` : "";
    return `<xf numFmtId="${x.date ? 164 : 0}" fontId="${x.font}" fillId="${x.fill ?? 0}" borderId="${x.border ?? 0}" xfId="0"${x.date ? ' applyNumberFormat="1"' : ""} applyFont="1"${x.fill ? ' applyFill="1"' : ""}${x.border ? ' applyBorder="1"' : ""}${align ? ' applyAlignment="1">' + align + "</xf>" : "/>"}`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="${FONTS.length}">${FONTS.join("")}</fonts><fills count="${FILLS.length}">${FILLS.join("")}</fills><borders count="${BORDERS.length}">${BORDERS.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

// ---- helpers ------------------------------------------------------------------------
export function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML 1.0 forbids most control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** Excel's day number for a calendar date (1900 date system). */
export function excelDate(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

function cellXml(ref: string, cell: Cell): string {
  let value: Value;
  let style: StyleName | undefined;
  if (cell && typeof cell === "object" && "style" in cell) {
    value = cell.value;
    style = cell.style;
  } else value = cell as Value;
  let s = style ? STYLE_IDS.indexOf(style) : 0;
  const sAttr = s ? ` s="${s}"` : "";
  if (value === null || value === undefined || value === "") return s ? `<c r="${ref}"${sAttr}/>` : "";
  if (typeof value === "number") return `<c r="${ref}"${sAttr}><v>${value}</v></c>`;
  if (typeof value === "string") return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  if ("date" in value) {
    if (!style) s = STYLE_IDS.indexOf("date");
    return `<c r="${ref}" s="${s}"><v>${excelDate(...value.date)}</v></c>`;
  }
  const f = `<f>${esc(value.f.replace(/^=/, ""))}</f>`;
  if (typeof value.v === "number") return `<c r="${ref}"${sAttr}>${f}<v>${value.v}</v></c>`;
  return `<c r="${ref}"${sAttr} t="str">${f}<v>${esc(value.v ?? "")}</v></c>`;
}

function sheetXml(sh: SheetSpec): string {
  const rows = sh.rows
    .map((row, r) => {
      const cells = row.map((c, i) => cellXml(`${colName(i)}${r + 1}`, c)).join("");
      const ht = sh.rowHeights?.[r + 1];
      return cells || ht ? `<row r="${r + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cells}</row>` : "";
    })
    .join("");
  const cols = sh.cols?.length
    ? `<cols>${sh.cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"${c.hidden ? ' hidden="1"' : ""}/>`).join("")}</cols>`
    : "";
  const fr = sh.freeze;
  const pane = fr
    ? `<pane${fr.cols ? ` xSplit="${fr.cols}"` : ""} ySplit="${fr.rows}" topLeftCell="${colName(fr.cols ?? 0)}${fr.rows + 1}" activePane="${fr.cols ? "bottomRight" : "bottomLeft"}" state="frozen"/>`
    : "";
  const lists = sh.lists?.length
    ? `<dataValidations count="${sh.lists.length}">${sh.lists
        .map((l) => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${l.sqref}"><formula1>"${esc(l.values.join(","))}"</formula1></dataValidation>`)
        .join("")}</dataValidations>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${sh.tabColor ? `<sheetPr><tabColor rgb="FF${sh.tabColor}"/></sheetPr>` : ""}<sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${sh.autoFilter ? `<autoFilter ref="${sh.autoFilter}"/>` : ""}${lists}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape"/></worksheet>`;
}

/** Builds the .xlsx file bytes. */
export function buildXlsx(sheets: SheetSpec[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets
        .map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(stylesXml()),
  };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))));
  return zipSync(files, { level: 6 });
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 for writing the bytes to a file (no Buffer/btoa needed). */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)] + (b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? "=" : B64[c & 63]);
  }
  return out;
}

import { writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { buildFamilyWorkbook } from "../excel-export";
import { FamilyGraph } from "../graph";
import { translate } from "../i18n";
import { buildXlsx, colName, excelDate, toBase64 } from "../xlsx";
import { family } from "./fixture";

const build = (lang: "en" | "bm") => {
  const s = family();
  s.persons.find((p) => p.id === "norbidin")!.deathDate = "1990-05-02";
  s.persons.find((p) => p.id === "mirhayuzi")!.notes = 'Tom & "Jerry" <test>';
  return buildFamilyWorkbook(new FamilyGraph(s), { lang, t: (k, v) => translate(lang, k, v), homeId: "mirhayuzi", familyName: "Keluarga Test", today: "30/10/2026" });
};

describe("excel export", () => {
  it("has the six sheets with a row per person, marriage and parent link", () => {
    const sheets = build("bm");
    expect(sheets.map((s) => s.name)).toEqual(["Panduan", "Susur_Galur", "Ringkasan", "Ahli", "Perkahwinan", "Ibu_Bapa_Anak"]);
    const f = family();
    expect(sheets[3].rows.length - 4).toBe(f.persons.length);
    expect(sheets[4].rows.length - 4).toBe(f.unions.length);
    expect(sheets[5].rows.length - 4).toBe(f.links.length);
  });

  it("lays the outline out by family line with branch counts", () => {
    const outline = build("bm")[1].rows.slice(4);
    const name = (row: unknown[]) => {
      const c = row.find((x) => x && typeof x === "object" && "value" in x && typeof (x as { value: unknown }).value === "object" && (x as { value: { f?: string } }).value?.f?.startsWith("IFERROR(INDEX(Ahli!$B")) as { value: { v: string } } | undefined;
      return c?.value.v;
    };
    // Biggest family line first; Aminah sits beside Norbidin rather than starting her own line
    expect(name(outline[0])).toBe("sibil");
    const roots = outline.filter((r) => (r[0] as { value: string }).value === "—").map(name);
    expect(roots).toEqual(["sibil", "norbidin", "nisadad"]);
    // Mirhayuzi is in both his mother's and his father's family line, each listed in full
    expect(outline.map(name).filter((n) => n === "mirhayuzi")).toHaveLength(2);
    const total = (outline[0][6] as { value: { v: number } }).value.v;
    expect(total).toBe(7); // siti, ali; mirhayuzi, aishah, razak; fatimah, haffizuddin
  });

  it("writes a valid xlsx package with escaped text", () => {
    const bytes = buildXlsx(build("en"));
    const files = unzipSync(bytes);
    expect(Object.keys(files)).toContain("xl/worksheets/sheet4.xml");
    const people = strFromU8(files["xl/worksheets/sheet4.xml"]);
    expect(people).toContain("Tom &amp; &quot;Jerry&quot; &lt;test&gt;");
    expect(people).toContain(`<v>${excelDate(1990, 5, 2)}</v>`);
    expect(strFromU8(files["xl/workbook.xml"])).toContain('name="Family_Outline"');
    if (process.env.XLSX_OUT) {
      writeFileSync(process.env.XLSX_OUT, bytes);
      writeFileSync(process.env.XLSX_OUT.replace(".xlsx", "-bm.xlsx"), buildXlsx(build("bm")));
    }
  });

  it("small helpers", () => {
    expect([0, 25, 26, 27, 701, 702].map(colName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
    expect(excelDate(1900, 3, 1)).toBe(61);
    expect(toBase64(new Uint8Array([77, 97, 110]))).toBe("TWFu");
    expect(toBase64(new Uint8Array([77, 97]))).toBe("TWE=");
    expect(toBase64(new Uint8Array([77]))).toBe("TQ==");
  });
});

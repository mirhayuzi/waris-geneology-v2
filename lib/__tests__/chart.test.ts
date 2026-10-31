import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chartHtml, roundedPath, wrapName } from "../chart";
import { FamilyGraph } from "../graph";
import { layoutTree } from "../layout";
import { family } from "./fixture";

describe("family tree chart (PDF)", () => {
  const g = new FamilyGraph(family());
  const layout = layoutTree(g, "mohammad", { up: 2, down: 2, showAdd: false })!;
  const labels = {
    kicker: "SIJIL SALASILAH",
    title: "Keturunan Mohammad <bin> Norbidin",
    subtitle: "Keluarga Test",
    footer: "15 orang · 4 generasi",
    life: (p: { birthDate?: string }) => p.birthDate?.slice(0, 4) ?? "",
    deceased: "Meninggal dunia",
  };

  it("draws everyone in the layout, with safe text", () => {
    const html = chartHtml(layout, "a4", labels, { mirhayuzi: "data:image/jpeg;base64,AAAA" });
    for (const k of layout.cards) if (k.person) expect(html).toContain(`>${k.person.givenName}`);
    expect(html).toContain("Keturunan Mohammad &lt;bin&gt; Norbidin");
    expect(html).toContain('href="data:image/jpeg;base64,AAAA"');
    expect(html).toContain("size: A4 landscape");
    expect(chartHtml(layout, "a3", labels)).toContain("size: A3 landscape");
    if (process.env.CHART_OUT) writeFileSync(process.env.CHART_OUT, html);
  });

  it("rounds the corners of connecting lines", () => {
    expect(roundedPath([0, 0, 0, 50, 100, 50, 100, 100], 10)).toBe("M0 0 L0.0 40.0 Q0 50 10.0 50.0 L90.0 50.0 Q100 50 100.0 60.0 L100 100");
  });

  it("wraps long names into two lines", () => {
    expect(wrapName("Nur Syahidatul Munawwarah", 14)).toEqual(["Nur Syahidatul", "Munawwarah"]);
    expect(wrapName("A B C D E F G H I J K L M N O P", 6).length).toBe(2);
  });
});

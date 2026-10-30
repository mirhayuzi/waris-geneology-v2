import { describe, expect, it } from "vitest";
import { buildFamilyWorkbook } from "../excel-export";
import { FamilyGraph } from "../graph";
import { translate } from "../i18n";
import { connectionPath, relationText } from "../kinship";
import { countDescendants, layoutTree } from "../layout";
import { duplicatePairs } from "../merge";
import type { FamilySnapshot, Person, Sex } from "../model";
import { buildXlsx } from "../xlsx";

/**
 * A 5,000-person family, kept as a permanent check that big families stay fast.
 * Budgets are for a desktop test run; phones are roughly 5-10x slower, which is why
 * each budget is kept well under what would feel slow on a phone.
 */
const SIZE = 5000;

function bigFamily(): FamilySnapshot {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const male = ["Ahmad", "Mohammad", "Ali", "Hassan", "Ismail", "Yusof", "Razak", "Bakar", "Hamid", "Zainal", "Osman", "Kassim"];
  const female = ["Siti", "Aminah", "Fatimah", "Zainab", "Aishah", "Halimah", "Mariati", "Noraini", "Rohani", "Salmah", "Khadijah", "Maimunah"];
  const t = "2026-01-01T00:00:00.000Z";
  const persons: Person[] = [];
  const links: FamilySnapshot["links"] = [];
  const unions: FamilySnapshot["unions"] = [];
  const add = (sex: Sex, year: number, fatherName?: string) => {
    const names = sex === "male" ? male : female;
    const p: Person = {
      id: `p${persons.length}`,
      givenName: names[Math.floor(rnd() * names.length)],
      fatherName,
      sex,
      birthDate: String(year),
      living: year > 1950,
      createdAt: t,
      updatedAt: t,
    };
    persons.push(p);
    return p;
  };
  let gen = [add("male", 1850)];
  while (persons.length < SIZE) {
    const next: Person[] = [];
    for (const p of gen) {
      if (persons.length >= SIZE) break;
      if (rnd() < 0.15) continue; // some never married
      const spouse = add(p.sex === "male" ? "female" : "male", Number(p.birthDate) + 2);
      unions.push({
        id: `u${unions.length}`,
        partnerA: p.id,
        partnerB: spouse.id,
        status: "married",
        sortOrder: 0,
      });
      const father = p.sex === "male" ? p : spouse;
      const kids = 1 + Math.floor(rnd() * 6);
      for (let i = 0; i < kids && persons.length < SIZE; i++) {
        const k = add(rnd() < 0.5 ? "male" : "female", Number(p.birthDate) + 22 + i * 2, father.givenName);
        links.push({
          id: `${p.id}>${k.id}`,
          parentId: p.id,
          childId: k.id,
          kind: "birth",
        });
        links.push({
          id: `${spouse.id}>${k.id}`,
          parentId: spouse.id,
          childId: k.id,
          kind: "birth",
        });
        next.push(k);
      }
    }
    gen = next.length ? next : gen;
  }
  return {
    persons,
    unions,
    links,
    familyName: "Keluarga Besar",
    homePersonId: persons[persons.length - 1].id,
  };
}

const time = <T>(fn: () => T): [T, number] => {
  const start = performance.now();
  const out = fn();
  return [out, performance.now() - start];
};

describe("5,000-person family", () => {
  const snap = bigFamily();
  const [graph, buildMs] = time(() => new FamilyGraph(snap));
  const youngest = snap.persons[snap.persons.length - 1].id;

  it("builds the family index quickly", () => {
    expect(graph.size).toBe(SIZE);
    expect(buildMs).toBeLessThan(400);
  });

  it("lays out the biggest tree (founder, 4 generations down) quickly", () => {
    const [layout, ms] = time(() => layoutTree(graph, "p0", { up: 6, down: 4, showAdd: true }));
    expect(layout!.cards.length).toBeGreaterThan(300);
    expect(ms).toBeLessThan(500);
  });

  it("lays out from the youngest person, 6 generations up, quickly", () => {
    const [layout, ms] = time(() => layoutTree(graph, youngest, { up: 6, down: 4, showAdd: true }));
    expect(layout!.cards.length).toBeGreaterThan(20);
    expect(ms).toBeLessThan(200);
  });

  it("folding branches shrinks the tree and counts who is hidden", () => {
    const open = layoutTree(graph, "p0", { up: 0, down: 4, showAdd: false })!;
    const kids = graph.children("p0").map((k) => k.id);
    const [folded, ms] = time(() =>
      layoutTree(graph, "p0", {
        up: 0,
        down: 4,
        showAdd: false,
        collapsed: kids,
      }),
    );
    expect(folded!.cards.length).toBeLessThan(open.cards.length / 3);
    const first = folded!.cards.find((k) => k.person?.id === kids[0])!;
    expect(first.hidden).toBe(countDescendants(graph, kids[0]));
    expect(ms).toBeLessThan(300);
  });

  it("finds the relationship between the founder and the youngest quickly", () => {
    const [path, ms] = time(() => connectionPath(graph, "p0", youngest));
    expect(path).not.toBeNull();
    const [, ms2] = time(() => relationText(graph, youngest, "p0"));
    expect(ms + ms2).toBeLessThan(300);
  });

  it("checks for duplicates quickly", () => {
    const [, ms] = time(() => duplicatePairs(graph));
    expect(ms).toBeLessThan(2500);
  });

  it("exports the whole family to Excel in reasonable time", () => {
    const [bytes, ms] = time(() =>
      buildXlsx(
        buildFamilyWorkbook(graph, {
          lang: "bm",
          t: (k, v) => translate("bm", k, v),
          homeId: youngest,
          familyName: snap.familyName,
          today: "30/10/2026",
        }),
      ),
    );
    expect(bytes.length).toBeGreaterThan(10000);
    expect(ms).toBeLessThan(10000);
  });

  it("saves and reads a backup (no photos) quickly", () => {
    const [text, ms] = time(() => JSON.stringify(snap));
    const [back, ms2] = time(() => JSON.parse(text) as FamilySnapshot);
    expect(back.persons.length).toBe(SIZE);
    expect(ms + ms2).toBeLessThan(800);
  });
});

import { describe, expect, it } from "vitest";
import { FamilyGraph } from "../graph";
import { layoutTree } from "../layout";
import type { FamilySnapshot, Person, Sex } from "../model";

/** Haji Sogon with three wives, their children, and one child whose mother is not entered. */
function sogon(): FamilySnapshot {
  const t = "2026-01-01T00:00:00.000Z";
  const persons: Person[] = [];
  const P = (id: string, sex: Sex) => persons.push({ id, givenName: id, sex, living: true, createdAt: t, updatedAt: t });
  P("sogon", "male");
  ["sharifah", "nurati", "pesah"].forEach((w) => P(w, "female"));
  ["purnama", "mariam", "baharum", "fuad", "nursitah", "kamarul", "solo"].forEach((k) => P(k, "male"));
  const links: FamilySnapshot["links"] = [];
  const L = (parentId: string, childId: string) => links.push({ id: `${parentId}>${childId}`, parentId, childId, kind: "birth" });
  const kids: Record<string, string[]> = { sharifah: ["purnama", "mariam", "baharum"], nurati: ["fuad", "nursitah"], pesah: ["kamarul"] };
  for (const [w, ks] of Object.entries(kids))
    for (const k of ks) {
      L("sogon", k);
      L(w, k);
    }
  L("sogon", "solo");
  const unions = ["sharifah", "nurati", "pesah"].map((w, i) => ({ id: `u${i}`, partnerA: "sogon", partnerB: w, status: "married" as const, sortOrder: i }));
  return { persons, unions, links, familyName: "" };
}

describe("several wives", () => {
  const l = layoutTree(new FamilyGraph(sogon()), "sogon", { up: 0, down: 2, showAdd: false })!;
  const card = (id: string) => l.cards.find((k) => k.person?.id === id)!;

  it("puts the wives in their own numbered row below the husband", () => {
    const wives = ["sharifah", "nurati", "pesah"].map(card);
    expect(wives.map((w) => w.wife)).toEqual([1, 2, 3]);
    expect(new Set(wives.map((w) => w.y)).size).toBe(1);
    expect(wives[0].y).toBeGreaterThan(card("sogon").y + card("sogon").h);
  });

  it("puts each wife's children under her, marked with her number", () => {
    const groups: [string, string[]][] = [
      ["sharifah", ["purnama", "mariam", "baharum"]],
      ["nurati", ["fuad", "nursitah"]],
      ["pesah", ["kamarul"]],
    ];
    const wifeNo = (w: string) => card(w).wife!;
    for (const [w, ks] of groups) {
      const xs = ks.map((k) => card(k).x + card(k).w / 2);
      const wc = card(w).x + card(w).w / 2;
      expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - wc)).toBeLessThan(1);
      for (const k of ks) expect(card(k).mother).toBe(wifeNo(w));
    }
    expect(card("solo").mother).toBeUndefined();
    // lines down to the children take the wife's colour
    expect(l.tints.filter((t) => t === 1).length).toBe(3);
    expect(l.tints.length).toBe(l.curves.length);
  });

  it("never overlaps cards", () => {
    const people = l.cards.filter((k) => k.person);
    for (let i = 0; i < people.length; i++)
      for (let j = i + 1; j < people.length; j++) {
        const a = people[i];
        const b = people[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.person!.id} / ${b.person!.id}`).toBe(false);
      }
  });

  it("keeps one wife beside her husband as before", () => {
    const one = sogon();
    one.unions = one.unions.slice(0, 1);
    one.links = one.links.filter((x) => !x.parentId.match(/nurati|pesah/));
    const l1 = layoutTree(new FamilyGraph(one), "sogon", { up: 0, down: 2, showAdd: false })!;
    const w = l1.cards.find((k) => k.person?.id === "sharifah")!;
    expect(w.wife).toBeUndefined();
    expect(w.y).toBeLessThan(l1.cards.find((k) => k.person?.id === "purnama")!.y);
  });
});

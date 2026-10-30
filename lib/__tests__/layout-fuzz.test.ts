import { expect, it } from "vitest";
import { FamilyGraph } from "../graph";
import { layoutTree, lineBars } from "../layout";
import type { FamilySnapshot, LinkKind, Person } from "../model";

function rnd(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}
const KINDS: LinkKind[] = ["birth", "birth", "birth", "adopted", "step", "foster", "milk"];

/** Random families with odd shapes: several marriages, half siblings, cousin marriages, three parents. */
function randomFamily(seed: number, n: number): FamilySnapshot {
  const r = rnd(seed);
  const persons: Person[] = [];
  for (let i = 0; i < n; i++)
    persons.push({
      id: `p${i}`,
      givenName: `P${i}`,
      sex: r() < 0.5 ? "male" : "female",
      living: r() < 0.7,
      birthDate: String(1900 + Math.floor(i * 3 + r() * 10)),
      createdAt: "",
      updatedAt: "",
    });
  const links: FamilySnapshot["links"] = [];
  const unions: FamilySnapshot["unions"] = [];
  const pairs = new Set<string>();
  for (let i = 1; i < n; i++) {
    const np = r() < 0.15 ? 0 : r() < 0.3 ? 1 : r() < 0.95 ? 2 : 3;
    const used = new Set<number>();
    for (let k = 0; k < np; k++) {
      const p = Math.floor(r() * i); // parents are always earlier, so no loops
      if (used.has(p)) continue;
      used.add(p);
      links.push({
        id: `l${i}-${p}`,
        parentId: `p${p}`,
        childId: `p${i}`,
        kind: KINDS[Math.floor(r() * KINDS.length)],
      });
    }
  }
  for (let k = 0; k < n / 2; k++) {
    const a = Math.floor(r() * n);
    const b = Math.floor(r() * n);
    const key = [a, b].sort().join("|");
    if (a === b || pairs.has(key)) continue;
    pairs.add(key);
    unions.push({
      id: `u${k}`,
      partnerA: `p${a}`,
      partnerB: `p${b}`,
      status: (["married", "divorced", "widowed"] as const)[Math.floor(r() * 3)],
      sortOrder: Math.floor(r() * 3),
    });
  }
  return { persons, links, unions, familyName: "" };
}

it("tree layout never throws or produces bad numbers, for odd families and every setting", () => {
  const failures: string[] = [];
  for (let seed = 1; seed <= 80; seed++) {
    const snap = randomFamily(seed, 10 + (seed % 60));
    const g = new FamilyGraph(snap);
    for (const p of snap.persons.filter((_, i) => i % 7 === 0)) {
      for (let up = 0; up <= 6; up++)
        for (let down = 0; down <= 4; down++)
          for (const showAdd of [true, false]) {
            const at = `seed ${seed} ${p.id} up${up} down${down}`;
            try {
              const l = layoutTree(g, p.id, { up, down, showAdd });
              if (!l) {
                failures.push(`${at}: no layout`);
                continue;
              }
              if (!Number.isFinite(l.width) || !Number.isFinite(l.height) || l.cards.some((c) => !Number.isFinite(c.x) || !Number.isFinite(c.y)))
                failures.push(`${at}: NaN`);
              const keys = new Set<string>();
              for (const item of [...l.cards, ...l.frames, ...l.lines]) {
                if (keys.has(item.key)) failures.push(`${at}: duplicate key ${item.key}`);
                keys.add(item.key);
              }
              for (const ln of l.lines)
                for (const b of lineBars(ln, 1.6)) if (!(b.w > 0 && b.h > 0 && Number.isFinite(b.x + b.y))) failures.push(`${at}: bad line ${ln.key}`);
            } catch (e) {
              failures.push(`${at}: ${(e as Error).message}`);
            }
          }
    }
  }
  expect(failures.slice(0, 10)).toEqual([]);
});

it("turns connector lines into straight bars", () => {
  expect(lineBars({ key: "a", points: [10, 0, 10, 20, 50, 20] }, 2)).toEqual([
    { x: 9, y: -1, w: 2, h: 22 },
    { x: 9, y: 19, w: 42, h: 2 },
  ]);
  expect(lineBars({ key: "b", points: [0, 0, 10, 10] }, 2)).toHaveLength(2); // a diagonal is drawn as an elbow
  expect(lineBars({ key: "c", points: [5, 5, 5, 5] }, 2)).toEqual([]);
});

it("folds a branch away and shows how many are hidden", async () => {
  const { family } = await import("./fixture");
  const g = new FamilyGraph(family());
  // From Norbidin, 2 generations down: Mohammad, then his children
  const open = layoutTree(g, "norbidin", { up: 0, down: 2, showAdd: false })!;
  const me = open.cards.find((c) => c.person?.id === "mirhayuzi")!;
  expect(me.more).toBe(2); // Fatimah and Haffizuddin are below the 2 generations shown
  expect(open.cards.some((c) => c.person?.id === "aishah")).toBe(true);
  const folded = layoutTree(g, "norbidin", {
    up: 0,
    down: 2,
    showAdd: false,
    collapsed: ["mohammad"],
  })!;
  const moh = folded.cards.find((c) => c.person?.id === "mohammad")!;
  expect(moh.hidden).toBe(5); // 3 children + 2 grandchildren
  expect(folded.cards.some((c) => c.person?.id === "aishah")).toBe(false);
  expect(folded.width).toBeLessThan(open.width);
});

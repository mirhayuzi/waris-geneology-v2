import { sortKey } from "./dates";
import type { FamilyGraph } from "./graph";
import type { Person } from "./model";

/**
 * Generation number counted from the person's oldest recorded ancestor (who is Gen 1).
 * `from` is that ancestor; when several are equally far up, the father's line and
 * then the earliest born is used.
 */
export function generationOf(graph: FamilyGraph, id: string): { gen: number; from?: Person } {
  const depths = graph.ancestorDepths(id);
  let max = 0;
  for (const d of depths.values()) max = Math.max(max, d);
  if (max === 0) return { gen: 1 };
  const top = [...depths.entries()]
    .filter(([, d]) => d === max)
    .map(([pid]) => graph.get(pid)!)
    .sort((a, b) => (a.sex === b.sex ? 0 : a.sex === "male" ? -1 : 1) || sortKey(a.birthDate).localeCompare(sortKey(b.birthDate)));
  return { gen: max + 1, from: top[0] };
}

/** How many people in this person's branch (them and their descendants) have a photo. */
export function branchPhotos(graph: FamilyGraph, id: string): { withPhoto: number; total: number } {
  const p = graph.get(id);
  if (!p) return { withPhoto: 0, total: 0 };
  const people = [p, ...graph.descendantsByGeneration(id).flat()];
  return { withPhoto: people.filter((x) => !!x.photo).length, total: people.length };
}

export type BadgeKey = "head" | "parentOf" | "generations" | "deceased" | "birthplace";

/** Small facts shown as chips on the profile. */
export function badgesOf(graph: FamilyGraph, p: Person): { key: BadgeKey; n?: number; text?: string }[] {
  const out: { key: BadgeKey; n?: number; text?: string }[] = [];
  const gens = graph.descendantsByGeneration(p.id);
  const kids = graph.childLinksOf(p.id).length;
  // Head of a family line: no parents recorded, with descendants
  if (graph.parentLinksOf(p.id).length === 0 && gens.length) out.push({ key: "head" });
  if (kids) out.push({ key: "parentOf", n: kids });
  if (gens.length >= 2) out.push({ key: "generations", n: gens.length + 1 });
  if (!p.living) out.push({ key: "deceased" });
  if (p.birthPlace) out.push({ key: "birthplace", text: p.birthPlace });
  return out;
}

import { yearOf as year } from "./dates";
import type { FamilyGraph } from "./graph";
import type { Person } from "./model";

const norm = (s: string | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/\b(bin|binti|bt|bte|b\.)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Men in the tree who could be the father typed so far, best matches first.
 * `childId` (when editing) excludes the person themself and their descendants.
 */
export function fatherCandidates(graph: FamilyGraph, typed: string, childId?: string, limit = 6): Person[] {
  const q = norm(typed);
  if (q.length < 2) return [];
  const words = q.split(" ");
  const scored: { p: Person; score: number }[] = [];
  for (const p of graph.persons.values()) {
    if (p.sex !== "male" || p.id === childId) continue;
    if (childId && graph.isAncestor(childId, p.id)) continue;
    const given = norm(p.givenName);
    const full = norm(`${p.givenName} ${p.fatherName ?? ""} ${p.nickname ?? ""}`);
    if (!words.every((w) => full.includes(w))) continue;
    const score = given === q ? 0 : given.startsWith(q) ? 1 : full.startsWith(q) ? 2 : 3;
    scored.push({ p, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || graph.childLinksOf(b.p.id).length - graph.childLinksOf(a.p.id).length || a.p.givenName.localeCompare(b.p.givenName))
    .slice(0, limit)
    .map((s) => s.p);
}

/**
 * Existing people who look like the one about to be added: same given name and sex,
 * and nothing that rules them out (a different father, or birth years far apart).
 */
export function possibleDuplicates(
  graph: FamilyGraph,
  draft: Pick<Person, "givenName" | "sex" | "fatherName" | "birthDate">,
  fatherId?: string,
): Person[] {
  const name = norm(draft.givenName);
  if (!name) return [];
  const out: Person[] = [];
  for (const p of graph.persons.values()) {
    if (p.sex !== draft.sex || norm(p.givenName) !== name) continue;
    const theirFather = graph.father(p.id);
    if (fatherId && theirFather && theirFather.id !== fatherId) continue;
    const fn = norm(draft.fatherName);
    const theirFn = norm(p.fatherName ?? theirFather?.givenName);
    if (fn && theirFn && fn !== theirFn) continue;
    const y1 = year(draft.birthDate);
    const y2 = year(p.birthDate);
    if (y1 && y2 && Math.abs(y1 - y2) > 2) continue;
    out.push(p);
  }
  return out;
}

/**
 * People with a bin/binti name but no father linked, where a man of that name is in
 * the tree. Closest candidates first; a candidate's wife is the likely mother.
 */
export function unlinkedPeople(graph: FamilyGraph): { person: Person; candidates: Person[] }[] {
  const out: { person: Person; candidates: Person[] }[] = [];
  for (const p of graph.persons.values()) {
    if (!p.fatherName?.trim() || graph.father(p.id)) continue;
    const want = norm(p.fatherName).split(" ")[0];
    const candidates = fatherCandidates(graph, p.fatherName, p.id, 6).filter((f) => {
      // Only men whose own name matches (not ones whose father has that name)
      if (!norm(f.givenName).includes(want)) return false;
      // A man born after the child can't be the father
      const fy = year(f.birthDate);
      const cy = year(p.birthDate);
      return !(fy && cy && fy >= cy);
    });
    if (candidates.length) out.push({ person: p, candidates: candidates.slice(0, 3) });
  }
  return out.sort((a, b) => a.person.givenName.localeCompare(b.person.givenName));
}

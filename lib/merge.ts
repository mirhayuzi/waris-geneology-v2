import { yearOf } from "./dates";
import { FamilyGraph } from "./graph";
import type { FamilySnapshot, ParentLink, Person, Union } from "./model";

/** Fields removed for living people when the user shares with "hide details". */
const PRIVATE_FIELDS = ["birthDate", "birthPlace", "phone", "occupation", "notes", "photo"] as const;

/** A copy of the tree for sharing; optionally without living people's personal details. */
export function prepareShare(s: FamilySnapshot, opts: { hideLiving: boolean }): FamilySnapshot {
  if (!opts.hideLiving) return s;
  return {
    ...s,
    persons: s.persons.map((p) => {
      if (!p.living) return p;
      const q: Person = { ...p };
      for (const f of PRIVATE_FIELDS) delete q[f];
      return q;
    }),
  };
}

const empty = (v: unknown) => v === undefined || v === null || v === "";

/** True when two records hold the same details, ignoring timestamps and empty fields. */
function sameDetails(a: Person, b: Person): boolean {
  const clean = (p: Person) =>
    JSON.stringify(
      Object.entries(p)
        .filter(([k, v]) => k !== "createdAt" && k !== "updatedAt" && !empty(v))
        .sort(([x], [y]) => x.localeCompare(y)),
    );
  return clean(a) === clean(b);
}

/** `base` with any empty field filled from `extra`. */
function fillFrom(base: Person, extra: Person): Person {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(extra)) if (empty(out[k]) && !empty(v)) out[k] = v;
  return out as unknown as Person;
}

export interface MergeResult {
  snapshot: FamilySnapshot;
  added: number;
  updated: number;
  /** Incoming photo file names that should be written to disk (person took the incoming photo) */
  usePhotos: Set<string>;
}

/**
 * Adds a shared tree to this one. People are matched by id, so someone who came from
 * the same original tree is never doubled. When both sides edited a person, the newer
 * edit wins, but an empty field never wipes a filled one (a file shared with hidden
 * details or without photos can't erase anything).
 */
export function mergeSnapshots(local: FamilySnapshot, incoming: FamilySnapshot): MergeResult {
  const persons = new Map(local.persons.map((p) => [p.id, p]));
  const usePhotos = new Set<string>();
  let added = 0;
  let updated = 0;
  for (const inc of incoming.persons) {
    const mine = persons.get(inc.id);
    if (!mine) {
      persons.set(inc.id, inc);
      if (inc.photo) usePhotos.add(inc.photo);
      added++;
      continue;
    }
    const newer = inc.updatedAt > mine.updatedAt;
    const merged = newer ? fillFrom(inc, mine) : fillFrom(mine, inc);
    // Keep our own photo unless the incoming, newer person brings one
    if (newer && inc.photo) usePhotos.add(inc.photo);
    else if (mine.photo) merged.photo = mine.photo;
    else if (inc.photo) usePhotos.add(inc.photo);
    // Same details (ignoring timestamps): keep ours untouched, e.g. re-importing an unchanged Excel file
    if (sameDetails(merged, mine)) {
      persons.set(inc.id, mine);
      continue;
    }
    updated++;
    persons.set(inc.id, merged);
  }

  // Marriages: by id, and never two records for the same couple
  const unions = new Map<string, Union>(local.unions.map((u) => [u.id, u]));
  const pairOf = (u: Union) => [u.partnerA, u.partnerB].sort().join("|");
  const pairs = new Map(local.unions.map((u) => [pairOf(u), u.id]));
  for (const u of incoming.unions) {
    const existing = pairs.get(pairOf(u));
    if (existing) {
      const mine = unions.get(existing)!;
      unions.set(existing, {
        ...u,
        ...Object.fromEntries(Object.entries(mine).filter(([, v]) => !empty(v))),
        id: existing,
      } as Union);
    } else {
      unions.set(u.id, u);
      pairs.set(pairOf(u), u.id);
    }
  }

  // Parent links: one per parent-child pair
  const links = new Map<string, ParentLink>(local.links.map((l) => [`${l.parentId}>${l.childId}`, l]));
  for (const l of incoming.links) {
    const k = `${l.parentId}>${l.childId}`;
    if (!links.has(k)) links.set(k, l);
  }

  return {
    snapshot: {
      persons: [...persons.values()],
      unions: [...unions.values()],
      links: [...links.values()],
      familyName: local.familyName || incoming.familyName,
      homePersonId: local.homePersonId ?? incoming.homePersonId,
    },
    added,
    updated,
    usePhotos,
  };
}

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Pairs of people who are probably the same person entered twice (e.g. two relatives
 * each typed the same uncle): same name and sex, same or no father name, birth years
 * close or unknown, and not parent/child or married to each other.
 */
export function duplicatePairs(graph: FamilyGraph, dismissed: Set<string> = new Set()): [Person, Person][] {
  const groups = new Map<string, Person[]>();
  for (const p of graph.persons.values()) {
    const k = `${p.sex}|${norm(p.givenName)}`;
    const list = groups.get(k);
    if (list) list.push(p);
    else groups.set(k, [p]);
  }
  const out: [Person, Person][] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // work out each person's father name and birth year once, not once per pair
    const fathers = list.map((p) => norm(p.fatherName ?? graph.father(p.id)?.givenName));
    const years = list.map((p) => yearOf(p.birthDate));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        const fa = fathers[i];
        const fb = fathers[j];
        if (fa && fb && fa !== fb) continue;
        const ya = years[i];
        const yb = years[j];
        if (ya && yb && Math.abs(ya - yb) > 2) continue;
        if (dismissed.has(pairKey(a.id, b.id))) continue;
        if (graph.isAncestor(a.id, b.id) || graph.isAncestor(b.id, a.id) || graph.unionBetween(a.id, b.id)) continue;
        out.push([a, b]);
      }
    }
  }
  return out;
}

export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/**
 * Joins `dropId` into `keepId`: the kept person takes over all parents, children and
 * marriages of the other, and any details they were missing. The other is removed.
 */
export function joinPersons(s: FamilySnapshot, keepId: string, dropId: string): FamilySnapshot {
  const keep = s.persons.find((p) => p.id === keepId);
  const drop = s.persons.find((p) => p.id === dropId);
  if (!keep || !drop || keepId === dropId) return s;
  const merged = fillFrom(keep, drop);
  const persons = s.persons.filter((p) => p.id !== dropId).map((p) => (p.id === keepId ? merged : p));

  const swap = (id: string) => (id === dropId ? keepId : id);
  const seenLinks = new Set<string>();
  const links: ParentLink[] = [];
  for (const l of s.links) {
    const parentId = swap(l.parentId);
    const childId = swap(l.childId);
    const k = `${parentId}>${childId}`;
    if (parentId === childId || seenLinks.has(k)) continue;
    seenLinks.add(k);
    links.push({ ...l, parentId, childId });
  }
  const seenPairs = new Set<string>();
  const unions: Union[] = [];
  for (const u of s.unions) {
    const partnerA = swap(u.partnerA);
    const partnerB = swap(u.partnerB);
    const k = pairKey(partnerA, partnerB);
    if (partnerA === partnerB || seenPairs.has(k)) continue;
    seenPairs.add(k);
    unions.push({ ...u, partnerA, partnerB });
  }
  return {
    ...s,
    persons,
    links,
    unions,
    homePersonId: s.homePersonId === dropId ? keepId : s.homePersonId,
  };
}

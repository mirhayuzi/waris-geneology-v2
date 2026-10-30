import { sortKey } from "./dates";
import type { FamilyGraph } from "./graph";
import type { LinkKind, Person } from "./model";

/** "B is A's ___" in both languages. */
export interface Kin {
  en: string;
  bm: string;
}

const g = (sex: Person["sex"], male: string, female: string) => (sex === "female" ? female : male);

/** -1 when `b` is older than `ref`, 1 when younger, 0 when unknown. */
function elder(b: Person, ref: Person): number {
  const kb = sortKey(b.birthDate);
  const kr = sortKey(ref.birthDate);
  if (kb === "9999" || kr === "9999" || kb === kr) return 0;
  return kb < kr ? -1 : 1;
}

const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
const ord = (n: number) => ORD[n] ?? `${n}th`;
const greats = (n: number) => (n <= 0 ? "" : n === 1 ? "great-" : `${n}x great-`);

/** Blood relationship where B is `up` generations above the common ancestor from A, and `down` below it. */
export function bloodKin(up: number, down: number, b: Person, a: Person, half?: { sex: Person["sex"] }): Kin {
  const s = b.sex;
  if (up === 0 && down === 0) return { en: "self", bm: "diri sendiri" };
  if (up === 0) {
    // B is a descendant of A
    if (down === 1) return { en: g(s, "son", "daughter"), bm: g(s, "anak lelaki", "anak perempuan") };
    const bmDesc = ["", "anak", "cucu", "cicit", "piut", "canggah"][down] ?? `keturunan ke-${down}`;
    return { en: `${greats(down - 2)}grand${g(s, "son", "daughter")}`, bm: bmDesc };
  }
  if (down === 0) {
    if (up === 1) return { en: g(s, "father", "mother"), bm: g(s, "bapa", "ibu") };
    if (up === 2) return { en: g(s, "grandfather", "grandmother"), bm: g(s, "datuk", "nenek") };
    const bmUp = up === 3 ? "moyang" : `moyang (${up - 2} generasi ke atas)`;
    return { en: `${greats(up - 2)}grand${g(s, "father", "mother")}`, bm: `${bmUp} ${g(s, "lelaki", "perempuan")}` };
  }
  if (up === 1 && down === 1) {
    const e = elder(b, a);
    const bmBase = e < 0 ? g(s, "abang", "kakak") : e > 0 ? "adik" : g(s, "saudara lelaki", "saudara perempuan");
    if (half) {
      const side = half.sex === "male" ? "sebapa" : "seibu";
      return { en: `half-${g(s, "brother", "sister")}`, bm: `${bmBase} ${side}` };
    }
    return { en: g(s, "brother", "sister"), bm: bmBase };
  }
  if (down === 1) {
    // B is a sibling of A's ancestor
    if (up === 2) return { en: g(s, "uncle", "aunt"), bm: g(s, "bapa saudara", "ibu saudara") };
    if (up === 3) return { en: `great-${g(s, "uncle", "aunt")}`, bm: g(s, "datuk saudara", "nenek saudara") };
    return { en: `${greats(up - 2)}${g(s, "uncle", "aunt")}`, bm: `moyang saudara (${up - 2} generasi)` };
  }
  if (up === 1) {
    // B is a descendant of A's sibling
    if (down === 2) return { en: g(s, "nephew", "niece"), bm: "anak saudara" };
    if (down === 3) return { en: `grand${g(s, "nephew", "niece")}`, bm: "cucu saudara" };
    return { en: `${greats(down - 3)}grand${g(s, "nephew", "niece")}`, bm: `cicit saudara` };
  }
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  const bmCousin = degree === 1 ? "sepupu" : `${["", "", "dua", "tiga", "empat", "lima"][degree] ?? degree} pupu`;
  if (removed === 0) return { en: `${ord(degree)} cousin`, bm: bmCousin };
  const times = removed === 1 ? "once" : removed === 2 ? "twice" : `${removed} times`;
  const dir = up > down ? "atas" : "bawah";
  return { en: `${ord(degree)} cousin ${times} removed`, bm: `${bmCousin} (${removed} generasi ke ${dir})` };
}

interface BloodHit {
  up: number;
  down: number;
  half?: { sex: Person["sex"] };
}

/** Closest blood link between A and B through a common ancestor (or B/A themselves). */
export function findBlood(graph: FamilyGraph, aId: string, bId: string): BloodHit | null {
  const da = graph.ancestorDepths(aId);
  const db = graph.ancestorDepths(bId);
  let best: BloodHit | null = null;
  let commons: string[] = [];
  for (const [id, up] of da) {
    const down = db.get(id);
    if (down === undefined) continue;
    const total = up + down;
    if (!best || total < best.up + best.down || (total === best.up + best.down && up < best.up)) {
      best = { up, down };
      commons = [id];
    } else if (up === best.up && down === best.down) commons.push(id);
  }
  if (best && best.up > 0 && best.down > 0 && commons.length === 1) {
    // Only one shared ancestor at that level: half relation, unless that ancestor's partner is also an ancestor of both
    const only = graph.get(commons[0])!;
    const partnerShared = graph.partners(only.id).some((p) => da.get(p.id) === best!.up && db.get(p.id) === best!.down);
    if (!partnerShared && best.up === 1 && best.down === 1) best.half = { sex: only.sex };
  }
  return best;
}

function directLinkKind(graph: FamilyGraph, parentId: string, childId: string): LinkKind | undefined {
  return graph.parentLinksOf(childId).find((l) => l.parentId === parentId)?.kind;
}

const KIND_PARENT: Record<Exclude<LinkKind, "birth">, (s: Person["sex"]) => Kin> = {
  adopted: (s) => ({ en: `adoptive ${g(s, "father", "mother")}`, bm: g(s, "bapa angkat", "ibu angkat") }),
  foster: (s) => ({ en: `foster ${g(s, "father", "mother")}`, bm: g(s, "bapa pelihara", "ibu pelihara") }),
  step: (s) => ({ en: `step${g(s, "father", "mother")}`, bm: g(s, "bapa tiri", "ibu tiri") }),
  milk: (s) => ({ en: `milk ${g(s, "father", "mother")}`, bm: g(s, "bapa susuan", "ibu susuan") }),
};
const KIND_CHILD: Record<Exclude<LinkKind, "birth">, (s: Person["sex"]) => Kin> = {
  adopted: (s) => ({ en: `adopted ${g(s, "son", "daughter")}`, bm: "anak angkat" }),
  foster: (s) => ({ en: `foster ${g(s, "son", "daughter")}`, bm: "anak pelihara" }),
  step: (s) => ({ en: `step${g(s, "son", "daughter")}`, bm: "anak tiri" }),
  milk: (s) => ({ en: `milk ${g(s, "son", "daughter")}`, bm: "anak susuan" }),
};

/**
 * Every way B is related to A, closest first. Empty when no link is recorded.
 * Covers blood, marriage, in-laws, step, adoptive and milk (susuan) relations.
 */
export function relationships(graph: FamilyGraph, aId: string, bId: string): Kin[] {
  const a = graph.get(aId);
  const b = graph.get(bId);
  if (!a || !b || aId === bId) return [];
  const out: Kin[] = [];
  const add = (k: Kin) => {
    if (!out.some((o) => o.en === k.en)) out.push(k);
  };

  // Direct parent/child links carry their own kind (adopted, step, milk ...)
  const asParent = directLinkKind(graph, bId, aId);
  if (asParent && asParent !== "birth") add(KIND_PARENT[asParent](b.sex));
  const asChild = directLinkKind(graph, aId, bId);
  if (asChild && asChild !== "birth") add(KIND_CHILD[asChild](b.sex));

  // Marriage
  const union = graph.unionBetween(aId, bId);
  if (union) {
    const former = union.status === "divorced";
    add({
      en: `${former ? "former " : ""}${g(b.sex, "husband", "wife")}`,
      bm: `${former ? "bekas " : ""}${g(b.sex, "suami", "isteri")}`,
    });
  }

  // Blood
  const blood = findBlood(graph, aId, bId);
  if (blood && !(blood.up === 1 && blood.down === 0 && asParent && asParent !== "birth") && !(blood.up === 0 && blood.down === 1 && asChild && asChild !== "birth")) {
    add(bloodKin(blood.up, blood.down, b, a, blood.half));
  }

  if (out.length === 0 || !blood) {
    // B is the spouse of A's blood relative
    for (const r of graph.partners(bId)) {
      if (r.id === aId) continue;
      const hit = findBlood(graph, aId, r.id);
      if (!hit || (hit.up === 0 && hit.down === 0)) continue;
      add(spouseOfRelative(hit, r, b, a));
    }
    // B is a blood relative of A's spouse
    for (const s of graph.partners(aId)) {
      if (s.id === bId) continue;
      const hit = findBlood(graph, s.id, bId);
      if (!hit || (hit.up === 0 && hit.down === 0)) continue;
      add(relativeOfSpouse(hit, s, b));
    }
    // Besan: parents of a married couple
    for (const ca of graph.children(aId)) {
      if (graph.partners(ca.id).some((sp) => graph.parents(sp.id).some((q) => q.id === bId))) {
        add({ en: "co-parent-in-law", bm: "besan" });
        break;
      }
    }
    // Biras: spouses of two siblings
    for (const s of graph.partners(aId)) {
      for (const sib of graph.siblings(s.id)) {
        if (graph.partners(sib.person.id).some((p) => p.id === bId)) {
          add({ en: `${g(s.sex, "husband", "wife")}'s ${g(sib.person.sex, "brother", "sister")}'s ${g(b.sex, "husband", "wife")}`, bm: "biras" });
        }
      }
    }
  }
  return out;
}

function spouseOfRelative(hit: BloodHit, r: Person, b: Person, a: Person): Kin {
  const { up, down } = hit;
  if (up === 1 && down === 0) return { en: `step${g(b.sex, "father", "mother")}`, bm: g(b.sex, "bapa tiri", "ibu tiri") };
  if (up === 0 && down === 1) return { en: `${g(b.sex, "son", "daughter")}-in-law`, bm: "menantu" };
  if (up === 0 && down === 2) return { en: `grand${g(b.sex, "son", "daughter")}-in-law`, bm: "cucu menantu" };
  if (up === 1 && down === 1) {
    const e = elder(r, a);
    const bm = e < 0 ? `${g(b.sex, "abang", "kakak")} ipar` : e > 0 ? "adik ipar" : "ipar";
    return { en: `${g(b.sex, "brother", "sister")}-in-law`, bm };
  }
  if (up >= 2 && down === 1) {
    const k = bloodKin(up, down, b, a);
    return { en: `${k.en} (by marriage)`, bm: `${k.bm} (melalui perkahwinan)` };
  }
  const rk = bloodKin(up, down, r, a);
  return { en: `${rk.en}'s ${g(b.sex, "husband", "wife")}`, bm: `${g(b.sex, "suami", "isteri")} kepada ${rk.bm}` };
}

function relativeOfSpouse(hit: BloodHit, s: Person, b: Person): Kin {
  const { up, down } = hit;
  const sp = g(s.sex, "husband", "wife");
  const spBm = g(s.sex, "suami", "isteri");
  if (up === 1 && down === 0) return { en: `${g(b.sex, "father", "mother")}-in-law`, bm: g(b.sex, "bapa mertua", "ibu mertua") };
  if (up === 2 && down === 0) return { en: `${sp}'s grand${g(b.sex, "father", "mother")}`, bm: g(b.sex, "datuk mertua", "nenek mertua") };
  if (up === 0 && down === 1) return { en: `step${g(b.sex, "son", "daughter")}`, bm: "anak tiri" };
  if (up === 1 && down === 1) {
    const e = elder(b, s);
    const bm = e < 0 ? `${g(b.sex, "abang", "kakak")} ipar` : e > 0 ? "adik ipar" : "ipar";
    return { en: `${g(b.sex, "brother", "sister")}-in-law`, bm };
  }
  const k = bloodKin(up, down, b, s);
  return { en: `${sp}'s ${k.en}`, bm: `${k.bm} kepada ${spBm}` };
}

// ---------------------------------------------------------------------------
// Connection path: how two people are linked through any chain of parents,
// children and marriages, even when there is no single word for it.

export type Edge = "parent" | "child" | "spouse";

/** Shortest chain of people from A to B (A first, B last), or null when not connected. */
export function connectionPath(graph: FamilyGraph, aId: string, bId: string): { ids: string[]; edges: Edge[] } | null {
  if (!graph.get(aId) || !graph.get(bId)) return null;
  if (aId === bId) return { ids: [aId], edges: [] };
  const prev = new Map<string, { from: string; edge: Edge }>();
  const seen = new Set([aId]);
  let frontier = [aId];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      // Blood links first, so ties prefer fewer marriages
      const steps: [string, Edge][] = [
        ...graph.parentLinksOf(id).map((l) => [l.parentId, "parent"] as [string, Edge]),
        ...graph.childLinksOf(id).map((l) => [l.childId, "child"] as [string, Edge]),
        ...graph.partners(id).map((p) => [p.id, "spouse"] as [string, Edge]),
      ];
      for (const [n, edge] of steps) {
        if (seen.has(n)) continue;
        seen.add(n);
        prev.set(n, { from: id, edge });
        if (n === bId) {
          const ids = [bId];
          const edges: Edge[] = [];
          let cur = bId;
          while (cur !== aId) {
            const p = prev.get(cur)!;
            edges.unshift(p.edge);
            ids.unshift(p.from);
            cur = p.from;
          }
          return { ids, edges };
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

/** One hop in a described path: `to` is `from`'s `kin`. */
export interface PathStep {
  from: Person;
  to: Person;
  kin: Kin;
}

/**
 * The path as readable steps. Runs of parent/child links are merged into one blood
 * term (abang, sepupu, datuk ...); marriages become suami/isteri.
 */
export function describePath(graph: FamilyGraph, path: { ids: string[]; edges: Edge[] }): PathStep[] {
  const out: PathStep[] = [];
  let i = 0;
  while (i < path.edges.length) {
    const start = i;
    if (path.edges[i] === "spouse") {
      i++;
    } else {
      // up* then down* is one blood relationship
      while (i < path.edges.length && path.edges[i] === "parent") i++;
      while (i < path.edges.length && path.edges[i] === "child") i++;
    }
    const from = graph.get(path.ids[start])!;
    const to = graph.get(path.ids[i])!;
    const rel = relationships(graph, from.id, to.id);
    let kin = rel[0];
    if (!kin) {
      const up = path.edges.slice(start, i).filter((e) => e === "parent").length;
      const down = i - start - up;
      kin = bloodKin(up, down, to, from);
    }
    out.push({ from, to, kin });
  }
  return out;
}

/** "B is the ___ of A's ___": used when there is no single word for B. */
export interface ViaKin {
  via: Person;
  /** How `via` is related to A */
  aToVia: Kin;
  /** How B is related to `via` */
  viaToB: Kin;
  en: string;
  bm: string;
  /** Stable key for this kind of link, used for the user's own terms */
  key: string;
}

export function describeVia(graph: FamilyGraph, aId: string, bId: string): ViaKin | null {
  const a = graph.get(aId);
  const path = connectionPath(graph, aId, bId);
  if (!a || !path || path.ids.length < 3) return null;
  let best: ViaKin | null = null;
  let bestBlood = false;
  // Walk from A towards B; prefer a go-between who is A's blood relative, as far along as possible
  for (const viaId of path.ids.slice(1, -1)) {
    const aToVia = relationships(graph, aId, viaId)[0];
    const viaToB = relationships(graph, viaId, bId)[0];
    if (!aToVia || !viaToB) continue;
    const blood = !!findBlood(graph, aId, viaId);
    if (best && bestBlood && !blood) continue;
    const via = graph.get(viaId)!;
    best = {
      via,
      aToVia,
      viaToB,
      en: `${viaToB.en} of ${a.givenName}'s ${aToVia.en}`,
      bm: `${viaToB.bm} kepada ${aToVia.bm} ${a.givenName}`,
      key: `${aToVia.en}|${viaToB.en}`,
    };
    bestBlood = blood;
  }
  return best;
}

/** For blood relatives beyond parents: which side of A's family B comes from. */
export function familySide(graph: FamilyGraph, aId: string, bId: string): "father" | "mother" | undefined {
  const hit = findBlood(graph, aId, bId);
  if (!hit || hit.up < 2) return undefined;
  const f = graph.father(aId);
  const m = graph.mother(aId);
  const viaF = f && (f.id === bId || findBlood(graph, f.id, bId));
  const viaM = m && (m.id === bId || findBlood(graph, m.id, bId));
  if (viaF && !viaM) return "father";
  if (viaM && !viaF) return "mother";
  return undefined;
}

/** Everything needed to say how B is related to A, closest wording first. */
export interface RelationText {
  /** Direct terms (may be several, e.g. sepupu · isteri) */
  direct: Kin[];
  side?: "father" | "mother";
  /** When there is no direct term: B described through someone in between */
  via?: ViaKin;
  /** The user's own word for this kind of link, if they set one */
  custom?: string;
}

export function relationText(graph: FamilyGraph, aId: string, bId: string, customTerms: Record<string, string> = {}): RelationText | null {
  if (aId === bId) return null;
  const direct = relationships(graph, aId, bId);
  if (direct.length) return { direct, side: familySide(graph, aId, bId) };
  const via = describeVia(graph, aId, bId);
  if (via) return { direct: [], via, custom: customTerms[via.key] };
  return null;
}

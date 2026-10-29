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

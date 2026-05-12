import type { FamilyData, Marriage, Person } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RelationshipCategory =
  | "core"
  | "darah"
  | "saudara"
  | "perkahwinan"
  | "tiri"
  | "angkat";

export type RelationshipSide = "sebelah_ibu" | "sebelah_bapa";

export type RelationshipLabel = {
  category: RelationshipCategory;
  labelBm: string;
  side?: RelationshipSide | null;
  degree?: number;
  via?: string;
};

export type RelationshipResult = {
  aToB: RelationshipLabel[];
  bToA: RelationshipLabel[];
  /** Only set when at least one relationship exists. */
  primary?: { aToB: RelationshipLabel; bToA: RelationshipLabel };
};

// ── Graph helpers (public — reused in later chunks) ───────────────────────────
//
// NOTE: lib/mahram.ts has similar private helpers (bioAncestorDepths,
// bioParentsOf, bioChildrenOf, everSpousesOf) that filter to biological edges
// only. These helpers use ALL parentChildren types for the broader kinship
// taxonomy. Deduplication opportunity in Chunk 4.

export function getParents(memberId: string, family: FamilyData): string[] {
  return family.parentChildren
    .filter((pc) => pc.childId === memberId)
    .map((pc) => pc.parentId);
}

export function getChildren(memberId: string, family: FamilyData): string[] {
  return family.parentChildren
    .filter((pc) => pc.parentId === memberId)
    .map((pc) => pc.childId);
}

export function getSpouses(
  memberId: string,
  family: FamilyData,
): { spouseId: string; marriage: Marriage }[] {
  return family.marriages
    .filter((m) => m.husbandId === memberId || m.wifeId === memberId)
    .map((m) => ({
      spouseId: m.husbandId === memberId ? m.wifeId : m.husbandId,
      marriage: m,
    }));
}

type AncestorEntry = { id: string; side: RelationshipSide | null };

/**
 * BFS up parent-edges from `memberId` and return all ancestors at exactly
 * `targetDepth` levels up, with maternal/paternal side tracking.
 */
export function getAncestorsAtDepth(
  memberId: string,
  targetDepth: number,
  family: FamilyData,
): AncestorEntry[] {
  type Q = { id: string; depth: number; side: RelationshipSide | null };
  const queue: Q[] = [{ id: memberId, depth: 0, side: null }];
  const visited = new Set<string>([memberId]);
  const result: AncestorEntry[] = [];

  while (queue.length > 0) {
    const { id, depth, side } = queue.shift()!;
    if (depth === targetDepth) {
      result.push({ id, side });
      continue;
    }
    if (depth >= targetDepth) continue;

    for (const parentId of getParents(id, family)) {
      if (visited.has(parentId)) continue;
      visited.add(parentId);
      // Side is fixed at the first step (which of memberId's parents we walked through)
      let nextSide = side;
      if (depth === 0) {
        const p = family.persons.find((x) => x.id === parentId);
        nextSide = p?.gender === "female" ? "sebelah_ibu" : "sebelah_bapa";
      }
      queue.push({ id: parentId, depth: depth + 1, side: nextSide });
    }
  }
  return result;
}

/**
 * BFS down child-edges from `memberId` and return all descendants at exactly
 * `targetDepth` levels down.
 */
export function getDescendantsAtDepth(
  memberId: string,
  targetDepth: number,
  family: FamilyData,
): string[] {
  type Q = { id: string; depth: number };
  const queue: Q[] = [{ id: memberId, depth: 0 }];
  const visited = new Set<string>([memberId]);
  const result: string[] = [];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth === targetDepth) {
      result.push(id);
      continue;
    }
    if (depth >= targetDepth) continue;
    for (const childId of getChildren(id, family)) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      queue.push({ id: childId, depth: depth + 1 });
    }
  }
  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function personOf(id: string, family: FamilyData): Person | undefined {
  return family.persons.find((p) => p.id === id);
}

function lbl(
  category: RelationshipCategory,
  labelBm: string,
  extras?: Partial<RelationshipLabel>,
): RelationshipLabel {
  return { category, labelBm, ...extras };
}

/** True if xId and yId share at least one parent (i.e. are siblings). */
function areSiblings(xId: string, yId: string, family: FamilyData): boolean {
  if (xId === yId) return false;
  const px = new Set(getParents(xId, family));
  return getParents(yId, family).some((p) => px.has(p));
}

// ── Internal helpers (Chunk 3) ────────────────────────────────────────────────

/**
 * Returns all biological parents as a Set for quick membership tests.
 */
function bioParentSet(memberId: string, family: FamilyData): Set<string> {
  return new Set(getParents(memberId, family));
}

/**
 * Returns all siblings (shared ≥1 biological parent), excluding self.
 */
function getSiblings(memberId: string, family: FamilyData): string[] {
  const parents = getParents(memberId, family);
  const result = new Set<string>();
  for (const pid of parents) {
    for (const sibId of getChildren(pid, family)) {
      if (sibId !== memberId) result.add(sibId);
    }
  }
  return [...result];
}

/**
 * Sepupu degree 1: A and B share a grandparent (depth 2) but no parent.
 * Returns true if B is A's first cousin.
 */
function areFirstCousins(aId: string, bId: string, family: FamilyData): boolean {
  if (areSiblings(aId, bId, family)) return false;
  const gpA = new Set(getAncestorsAtDepth(aId, 2, family).map((e) => e.id));
  return getAncestorsAtDepth(bId, 2, family).some((e) => gpA.has(e.id));
}

// ── Detection (Chunk 1: direct labels only) ───────────────────────────────────

function detectSpouse(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  const active = family.marriages.find(
    (m) =>
      m.isActive &&
      ((m.husbandId === aId && m.wifeId === bId) ||
        (m.wifeId === aId && m.husbandId === bId)),
  );
  if (!active) return null;

  const a = personOf(aId, family);
  const b = personOf(bId, family);
  // aToB: "A is B's ___" — what label does A carry from B's perspective
  const aLabel =
    a?.gender === "male" ? "Suami" : a?.gender === "female" ? "Isteri" : "Pasangan";
  // bToA: "B is A's ___"
  const bLabel =
    b?.gender === "male" ? "Suami" : b?.gender === "female" ? "Isteri" : "Pasangan";

  return {
    aToB: lbl("perkahwinan", aLabel),
    bToA: lbl("perkahwinan", bLabel),
  };
}

function detectParentChild(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  const a = personOf(aId, family);
  const b = personOf(bId, family);

  const bIsParentOfA = family.parentChildren.some(
    (pc) => pc.parentId === bId && pc.childId === aId,
  );
  if (bIsParentOfA) {
    // aToB: A is B's child
    const childLabel =
      a?.gender === "male"
        ? "Anak Lelaki"
        : a?.gender === "female"
          ? "Anak Perempuan"
          : "Anak";
    // bToA: B is A's parent
    const parentLabel =
      b?.gender === "male" ? "Bapa" : b?.gender === "female" ? "Ibu" : "Ibu/Bapa";
    return { aToB: lbl("core", childLabel), bToA: lbl("core", parentLabel) };
  }

  const aIsParentOfB = family.parentChildren.some(
    (pc) => pc.parentId === aId && pc.childId === bId,
  );
  if (aIsParentOfB) {
    // aToB: A is B's parent
    const parentLabel =
      a?.gender === "male" ? "Bapa" : a?.gender === "female" ? "Ibu" : "Ibu/Bapa";
    // bToA: B is A's child
    const childLabel =
      b?.gender === "male"
        ? "Anak Lelaki"
        : b?.gender === "female"
          ? "Anak Perempuan"
          : "Anak";
    return { aToB: lbl("core", parentLabel), bToA: lbl("core", childLabel) };
  }

  return null;
}

function detectGrandparentGrandchild(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  // Case 1: B is A's grandparent (B is 2 levels above A)
  const ancestorsOfA = getAncestorsAtDepth(aId, 2, family);
  const bEntry = ancestorsOfA.find((e) => e.id === bId);
  if (bEntry) {
    const b = personOf(bId, family);
    const gp =
      b?.gender === "male" ? "Datuk" : b?.gender === "female" ? "Nenek" : "Datuk/Nenek";
    const sideStr = bEntry.side ? ` ${bEntry.side.replace(/_/g, " ")}` : "";
    return {
      // aToB: A is B's grandchild
      aToB: lbl("darah", "Cucu"),
      // bToA: B is A's grandparent (with side)
      bToA: lbl("darah", `${gp}${sideStr}`, { side: bEntry.side }),
    };
  }

  // Case 2: A is B's grandparent (A is 2 levels above B)
  const ancestorsOfB = getAncestorsAtDepth(bId, 2, family);
  const aEntry = ancestorsOfB.find((e) => e.id === aId);
  if (aEntry) {
    const a = personOf(aId, family);
    const gp =
      a?.gender === "male" ? "Datuk" : a?.gender === "female" ? "Nenek" : "Datuk/Nenek";
    const sideStr = aEntry.side ? ` ${aEntry.side.replace(/_/g, " ")}` : "";
    return {
      // aToB: A is B's grandparent (with side)
      aToB: lbl("darah", `${gp}${sideStr}`, { side: aEntry.side }),
      // bToA: B is A's grandchild
      bToA: lbl("darah", "Cucu"),
    };
  }

  return null;
}

function detectSibling(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  const parentsOfA = new Set(getParents(aId, family));
  const parentsOfB = new Set(getParents(bId, family));
  const hasSharedParent = [...parentsOfA].some((p) => parentsOfB.has(p));
  if (!hasSharedParent) return null;

  const a = personOf(aId, family);
  const b = personOf(bId, family);
  const aBirth = a?.birthDate ?? null;
  const bBirth = b?.birthDate ?? null;

  // null = unknown (no birth dates to compare)
  let aIsOlderThanB: boolean | null = null;
  if (aBirth && bBirth) {
    const cmp = aBirth.localeCompare(bBirth);
    if (cmp < 0) aIsOlderThanB = true;
    else if (cmp > 0) aIsOlderThanB = false;
  }

  // Qualifier distinguishes penuh (both parents shared → no suffix),
  // sebapa (shared father only), seibu (shared mother only).
  const qualifier = siblingQualifier(aId, bId, family);

  function siblingLabelBm(
    person: Person | undefined,
    isOlder: boolean | null,
  ): string {
    if (isOlder === null) return `Adik-beradik${qualifier}`;
    if (isOlder)
      return person?.gender === "male"
        ? `Abang${qualifier}`
        : person?.gender === "female"
          ? `Kakak${qualifier}`
          : `Adik-beradik${qualifier}`;
    return `Adik${qualifier}`;
  }

  // aToB: "A is B's ___" — label based on A's age/gender relative to B
  const aToBLabel = siblingLabelBm(a, aIsOlderThanB);
  // bToA: "B is A's ___" — label based on B's age/gender relative to A
  const bToALabel = siblingLabelBm(
    b,
    aIsOlderThanB === null ? null : !aIsOlderThanB,
  );

  return {
    aToB: lbl("saudara", aToBLabel),
    bToA: lbl("saudara", bToALabel),
  };
}

// ── Detection (Chunk 2: sideling labels) ─────────────────────────────────────

/**
 * Pakcik/Makcik ↔ Anak Saudara.
 *
 * Direction decision: "Pakcik sebelah X" — the side is determined by the
 * gender of A's parent who is B's sibling (female parent → sebelah ibu).
 * Multiple matches (endogamy: B is sibling of BOTH parents) return only the
 * first match; Chunk 4 can surface all.
 */
function detectPakcikAnakSaudara(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  const a = personOf(aId, family);
  const b = personOf(bId, family);

  // Case 1: B is a sibling of one of A's parents → B is A's Pakcik/Makcik
  for (const parentId of getParents(aId, family)) {
    if (!areSiblings(bId, parentId, family)) continue;
    const parent = personOf(parentId, family);
    const side: RelationshipSide =
      parent?.gender === "female" ? "sebelah_ibu" : "sebelah_bapa";
    const pakcikLabel =
      b?.gender === "male" ? "Pakcik" : b?.gender === "female" ? "Makcik" : "Pakcik/Makcik";
    const anakLabel =
      a?.gender === "male"
        ? "Anak Saudara Lelaki"
        : a?.gender === "female"
          ? "Anak Saudara Perempuan"
          : "Anak Saudara";
    return {
      // A is B's anak saudara
      aToB: lbl("saudara", anakLabel),
      // B is A's pakcik/makcik
      bToA: lbl("saudara", `${pakcikLabel} ${side.replace(/_/g, " ")}`, { side }),
    };
  }

  // Case 2: A is a sibling of one of B's parents → A is B's Pakcik/Makcik
  for (const parentId of getParents(bId, family)) {
    if (!areSiblings(aId, parentId, family)) continue;
    const parent = personOf(parentId, family);
    const side: RelationshipSide =
      parent?.gender === "female" ? "sebelah_ibu" : "sebelah_bapa";
    const pakcikLabel =
      a?.gender === "male" ? "Pakcik" : a?.gender === "female" ? "Makcik" : "Pakcik/Makcik";
    const anakLabel =
      b?.gender === "male"
        ? "Anak Saudara Lelaki"
        : b?.gender === "female"
          ? "Anak Saudara Perempuan"
          : "Anak Saudara";
    return {
      // A is B's pakcik/makcik
      aToB: lbl("saudara", `${pakcikLabel} ${side.replace(/_/g, " ")}`, { side }),
      // B is A's anak saudara
      bToA: lbl("saudara", anakLabel),
    };
  }

  return null;
}

/**
 * Datuk/Nenek Saudara ↔ Cucu Saudara.
 *
 * Side comes from A's grandparent entry (which tracks which of A's parents
 * was the first step). Returns the first matching grandparent; Chunk 4 can
 * surface all for endogamous trees.
 */
function detectDatukSaudaraCucuSaudara(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  const a = personOf(aId, family);
  const b = personOf(bId, family);

  // Case 1: B is a sibling of one of A's grandparents → B is A's Datuk/Nenek Saudara
  for (const gpEntry of getAncestorsAtDepth(aId, 2, family)) {
    if (!areSiblings(bId, gpEntry.id, family)) continue;
    const gpSaudaraLabel =
      b?.gender === "male"
        ? "Datuk Saudara"
        : b?.gender === "female"
          ? "Nenek Saudara"
          : "Datuk/Nenek Saudara";
    const cucuLabel =
      a?.gender === "male"
        ? "Cucu Saudara Lelaki"
        : a?.gender === "female"
          ? "Cucu Saudara Perempuan"
          : "Cucu Saudara";
    const sideStr = gpEntry.side ? ` ${gpEntry.side.replace(/_/g, " ")}` : "";
    return {
      // A is B's cucu saudara
      aToB: lbl("saudara", cucuLabel),
      // B is A's datuk/nenek saudara (with side from A's ancestry)
      bToA: lbl("saudara", `${gpSaudaraLabel}${sideStr}`, { side: gpEntry.side }),
    };
  }

  // Case 2: A is a sibling of one of B's grandparents → A is B's Datuk/Nenek Saudara
  for (const gpEntry of getAncestorsAtDepth(bId, 2, family)) {
    if (!areSiblings(aId, gpEntry.id, family)) continue;
    const gpSaudaraLabel =
      a?.gender === "male"
        ? "Datuk Saudara"
        : a?.gender === "female"
          ? "Nenek Saudara"
          : "Datuk/Nenek Saudara";
    const cucuLabel =
      b?.gender === "male"
        ? "Cucu Saudara Lelaki"
        : b?.gender === "female"
          ? "Cucu Saudara Perempuan"
          : "Cucu Saudara";
    const sideStr = gpEntry.side ? ` ${gpEntry.side.replace(/_/g, " ")}` : "";
    return {
      // A is B's datuk/nenek saudara (side from B's ancestry)
      aToB: lbl("saudara", `${gpSaudaraLabel}${sideStr}`, { side: gpEntry.side }),
      // B is A's cucu saudara
      bToA: lbl("saudara", cucuLabel),
    };
  }

  return null;
}

/**
 * Pupu (Sepupu / Sepupu 2 Kali / Sepupu 3 Kali / Sepupu 4 Kali).
 *
 * Algorithm: find the shallowest depth D (2–5) at which A and B share an
 * ancestor where both are at EQUAL depth from it. Degree = D - 1.
 *
 * Sibling guard: siblings share a parent (depth 1), so they would also share
 * grandparents — we explicitly exclude them to avoid false sepupu labels.
 *
 * Side: applied only when ALL shared ancestors at that depth are on the same
 * side (from each perspective independently). Mixed sides → no suffix.
 */
function detectPupu(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  // Siblings are siblings, not sepupu
  if (areSiblings(aId, bId, family)) return null;

  for (let depth = 2; depth <= 5; depth++) {
    const ancestorsOfA = getAncestorsAtDepth(aId, depth, family);
    const ancestorsOfB = getAncestorsAtDepth(bId, depth, family);
    const aIdSet = new Set(ancestorsOfA.map((e) => e.id));
    const sharedBEntries = ancestorsOfB.filter((e) => aIdSet.has(e.id));
    if (sharedBEntries.length === 0) continue;

    const degree = depth - 1;
    const baseLabel = pupuDegreeLabel(degree);
    const sharedIdSet = new Set(sharedBEntries.map((e) => e.id));
    const aMatchEntries = ancestorsOfA.filter((e) => sharedIdSet.has(e.id));

    // Compute side from A's perspective (all shared ancestors on same side?)
    const aSidesRaw = aMatchEntries.map((e) => e.side).filter((s): s is RelationshipSide => s !== null);
    const aSides = new Set(aSidesRaw);
    const aToBSide: RelationshipSide | null = aSides.size === 1 ? [...aSides][0] : null;

    // Compute side from B's perspective
    const bSidesRaw = sharedBEntries.map((e) => e.side).filter((s): s is RelationshipSide => s !== null);
    const bSides = new Set(bSidesRaw);
    const bToASide: RelationshipSide | null = bSides.size === 1 ? [...bSides][0] : null;

    const aToBStr = aToBSide ? ` ${aToBSide.replace(/_/g, " ")}` : "";
    const bToAStr = bToASide ? ` ${bToASide.replace(/_/g, " ")}` : "";

    return {
      aToB: lbl("saudara", `${baseLabel}${aToBStr}`, { degree, side: aToBSide }),
      bToA: lbl("saudara", `${baseLabel}${bToAStr}`, { degree, side: bToASide }),
    };
  }

  return null;
}

function pupuDegreeLabel(degree: number): string {
  const names: Record<number, string> = {
    1: "Sepupu",
    2: "Sepupu 2 Kali",
    3: "Sepupu 3 Kali",
    4: "Sepupu 4 Kali",
  };
  return names[degree] ?? `Sepupu ${degree} Kali`;
}

// ── Detection (Chunk 3: in-law + tiri labels) ────────────────────────────────

/**
 * Refine the sibling label to distinguish Penuh / Sebapa / Seibu / Tiri.
 *
 * Called from detectSibling to tag the sub-type; the label string itself
 * is "Abang / Kakak / Adik / Adik-beradik" plus a qualifier suffix.
 *
 * Penuh:  share both parents
 * Sebapa: share father only  (different mothers)
 * Seibu:  share mother only  (different fathers)
 * Tiri:   no shared bio parent — handled separately in detectStepSibling
 */
function siblingQualifier(
  aId: string,
  bId: string,
  family: FamilyData,
): " Sebapa" | " Seibu" | "" {
  const parentsA = getParents(aId, family);
  const parentsB = new Set(getParents(bId, family));

  const shared = parentsA.filter((p) => parentsB.has(p));
  if (shared.length >= 2) return ""; // penuh — no suffix

  if (shared.length === 1) {
    const sharedPerson = personOf(shared[0], family);
    if (sharedPerson?.gender === "male") return " Sebapa";
    if (sharedPerson?.gender === "female") return " Seibu";
  }
  return "";
}

/**
 * Mertua (in-law parents).
 *
 * Design decision — Mahram kekal: we include parents of ALL spouses
 * (active AND inactive marriages) because under Syafi'e fiqh, the mahram
 * bond (haramah mu'abbadah) persists after divorce or the spouse's death,
 * once the marriage was consummated.  The application cannot verify
 * consummation so we err on the side of inclusion.
 */
function detectMertua(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  const b = personOf(bId, family);

  // Case 1: B is a parent of one of A's spouses → B is A's Mertua
  for (const { spouseId } of getSpouses(aId, family)) {
    if (getParents(spouseId, family).includes(bId)) {
      const mertua =
        b?.gender === "male"
          ? "Bapa Mertua"
          : b?.gender === "female"
            ? "Ibu Mertua"
            : "Ibu/Bapa Mertua";
      const a = personOf(aId, family);
      const menantu =
        a?.gender === "male"
          ? "Menantu Lelaki"
          : a?.gender === "female"
            ? "Menantu Perempuan"
            : "Menantu";
      return {
        aToB: lbl("perkahwinan", menantu),
        bToA: lbl("perkahwinan", mertua),
      };
    }
  }

  // Case 2: B has a spouse who is a child of A → B is A's Menantu
  const a = personOf(aId, family);
  for (const childId of getChildren(aId, family)) {
    const childSpouses = getSpouses(childId, family);
    if (childSpouses.some((s) => s.spouseId === bId)) {
      const menantu =
        b?.gender === "male"
          ? "Menantu Lelaki"
          : b?.gender === "female"
            ? "Menantu Perempuan"
            : "Menantu";
      const mertua =
        a?.gender === "male"
          ? "Bapa Mertua"
          : a?.gender === "female"
            ? "Ibu Mertua"
            : "Ibu/Bapa Mertua";
      return {
        aToB: lbl("perkahwinan", mertua),
        bToA: lbl("perkahwinan", menantu),
      };
    }
  }

  return null;
}

/**
 * Ipar (spouse's sibling OR sibling's spouse).
 *
 * Two pathways:
 *   a) A's spouse has a sibling = B
 *   b) A's sibling has a spouse = B
 *
 * Age comparison: B's age vs A's age determines abang/kakak/adik.
 * If both pathways apply (rare), we only return one label (first found) to
 * avoid duplicates; both will still be in aToB[] via the outer loop in
 * getRelationships if needed.
 */
function detectIpar(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  const a = personOf(aId, family);
  const b = personOf(bId, family);

  function iparLabel(
    personB: Person | undefined,
    personA: Person | undefined,
  ): string {
    const bBirth = personB?.birthDate ?? null;
    const aBirth = personA?.birthDate ?? null;
    if (!bBirth || !aBirth) return "Ipar";
    const cmp = bBirth.localeCompare(aBirth);
    if (cmp < 0) {
      // B is older than A
      return personB?.gender === "male"
        ? "Abang Ipar"
        : personB?.gender === "female"
          ? "Kakak Ipar"
          : "Ipar";
    }
    if (cmp > 0) return "Adik Ipar";
    return "Ipar";
  }

  // Pathway a: A's spouse's sibling = B
  for (const { spouseId } of getSpouses(aId, family)) {
    if (areSiblings(bId, spouseId, family)) {
      return {
        aToB: lbl("perkahwinan", iparLabel(b, a)),
        bToA: lbl("perkahwinan", iparLabel(a, b)),
      };
    }
  }

  // Pathway b: A's sibling's spouse = B
  for (const sibId of getSiblings(aId, family)) {
    if (getSpouses(sibId, family).some((s) => s.spouseId === bId)) {
      return {
        aToB: lbl("perkahwinan", iparLabel(b, a)),
        bToA: lbl("perkahwinan", iparLabel(a, b)),
      };
    }
  }

  return null;
}

/**
 * Biras: A's spouse's sibling's spouse = B.
 *
 * 3-hop path: A → spouse → spouse's sibling → sibling's spouse = B
 * Classic Malay pattern: two brothers marrying two sisters are biras.
 * The 'via' field carries the intermediate sibling's ID for UI display.
 */
function detectBiras(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  for (const { spouseId: aSpouseId } of getSpouses(aId, family)) {
    for (const sibOfSpouseId of getSiblings(aSpouseId, family)) {
      if (
        getSpouses(sibOfSpouseId, family).some((s) => s.spouseId === bId)
      ) {
        return {
          aToB: lbl("perkahwinan", "Biras", { via: sibOfSpouseId }),
          bToA: lbl("perkahwinan", "Biras", { via: sibOfSpouseId }),
        };
      }
    }
  }
  return null;
}

/**
 * Besan: A's child's spouse's parent = B.
 *
 * Path: A → child → child's spouse → spouse's parent = B
 * Both genders yield "Besan" (no gender split in common usage).
 * The 'via' field carries the child's ID.
 */
function detectBesan(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  for (const childId of getChildren(aId, family)) {
    for (const { spouseId: childSpouseId } of getSpouses(childId, family)) {
      if (getParents(childSpouseId, family).includes(bId)) {
        return {
          aToB: lbl("perkahwinan", "Besan", { via: childId }),
          bToA: lbl("perkahwinan", "Besan", { via: childId }),
        };
      }
    }
  }

  // Symmetric: B → child → child's spouse → spouse's parent = A
  for (const childId of getChildren(bId, family)) {
    for (const { spouseId: childSpouseId } of getSpouses(childId, family)) {
      if (getParents(childSpouseId, family).includes(aId)) {
        return {
          aToB: lbl("perkahwinan", "Besan", { via: childId }),
          bToA: lbl("perkahwinan", "Besan", { via: childId }),
        };
      }
    }
  }

  return null;
}

/**
 * Ipar Saudara: A's spouse's first cousin OR A's first cousin's spouse = B.
 *
 * Degree-1 sepupu only (do not extend to dua pupu's spouse).
 * Two pathways:
 *   a) A's spouse has a first cousin = B
 *   b) A's first cousin has a spouse = B
 */
function detectIparSaudara(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  // Pathway a: A's spouse's first cousin = B
  for (const { spouseId } of getSpouses(aId, family)) {
    if (areFirstCousins(spouseId, bId, family)) {
      return {
        aToB: lbl("perkahwinan", "Ipar Saudara"),
        bToA: lbl("perkahwinan", "Ipar Saudara"),
      };
    }
  }

  // Pathway b: A's first cousin's spouse = B
  const aParents = new Set(getParents(aId, family));
  const aGp = new Set(getAncestorsAtDepth(aId, 2, family).map((e) => e.id));
  for (const gpId of aGp) {
    for (const gpChildId of getChildren(gpId, family)) {
      if (aParents.has(gpChildId)) continue; // skip A's own parents
      // gpChildId is A's aunt/uncle → their children are A's first cousins
      for (const cousinId of getChildren(gpChildId, family)) {
        if (getSpouses(cousinId, family).some((s) => s.spouseId === bId)) {
          return {
            aToB: lbl("perkahwinan", "Ipar Saudara"),
            bToA: lbl("perkahwinan", "Ipar Saudara"),
          };
        }
      }
    }
  }

  return null;
}

/**
 * Bapa/Ibu Tiri (step-parent).
 *
 * B is a step-parent of A when:
 *   1. B is currently married to one of A's biological parents, AND
 *   2. B is NOT one of A's biological parents.
 *
 * "Currently married" = marriage record with isActive=true, OR marriage
 * where the spouse (bio-parent) is deceased (death ends the marriage but
 * the parental relationship persists).  We include all marriages where
 * isActive=true; inactive/divorced marriages are excluded — the step-parent
 * relationship is socially contingent on the ongoing union.
 */
function detectStepParent(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  const bioParents = bioParentSet(aId, family);
  if (bioParents.has(bId)) return null; // B is A's actual parent

  const b = personOf(bId, family);
  const a = personOf(aId, family);

  // Check if B is the active spouse of one of A's bio-parents
  for (const bioParentId of bioParents) {
    const bioParent = personOf(bioParentId, family);
    const isDeceased = !(bioParent?.isAlive ?? true);
    for (const m of family.marriages) {
      const involvesBioParent =
        m.husbandId === bioParentId || m.wifeId === bioParentId;
      const involvesB = m.husbandId === bId || m.wifeId === bId;
      if (!involvesBioParent || !involvesB) continue;
      // Include if active, or if bio-parent is deceased (marriage didn't end by divorce)
      if (!m.isActive && !isDeceased) continue;

      const stepParentLabel =
        b?.gender === "male"
          ? "Bapa Tiri"
          : b?.gender === "female"
            ? "Ibu Tiri"
            : "Ibu/Bapa Tiri";
      const stepChildLabel =
        a?.gender === "male"
          ? "Anak Tiri Lelaki"
          : a?.gender === "female"
            ? "Anak Tiri Perempuan"
            : "Anak Tiri";
      return {
        aToB: lbl("tiri", stepChildLabel),
        bToA: lbl("tiri", stepParentLabel),
      };
    }
  }

  // Symmetric: A is a step-parent of B
  const bioParentsB = bioParentSet(bId, family);
  if (bioParentsB.has(aId)) return null;

  for (const bioParentId of bioParentsB) {
    const bioParent = personOf(bioParentId, family);
    const isDeceased = !(bioParent?.isAlive ?? true);
    for (const m of family.marriages) {
      const involvesBioParent =
        m.husbandId === bioParentId || m.wifeId === bioParentId;
      const involvesA = m.husbandId === aId || m.wifeId === aId;
      if (!involvesBioParent || !involvesA) continue;
      if (!m.isActive && !isDeceased) continue;

      const stepParentLabel =
        a?.gender === "male"
          ? "Bapa Tiri"
          : a?.gender === "female"
            ? "Ibu Tiri"
            : "Ibu/Bapa Tiri";
      const stepChildLabel =
        b?.gender === "male"
          ? "Anak Tiri Lelaki"
          : b?.gender === "female"
            ? "Anak Tiri Perempuan"
            : "Anak Tiri";
      return {
        aToB: lbl("tiri", stepParentLabel),
        bToA: lbl("tiri", stepChildLabel),
      };
    }
  }

  return null;
}

/**
 * Anak Tiri (step-child).
 *
 * B is A's step-child when:
 *   1. B is a child of one of A's spouses, AND
 *   2. B is NOT A's own biological child.
 *
 * We include children from ALL spouses (active marriages only) to match
 * the step-parent logic above.  Trade-off: a past (divorced) spouse's
 * children are excluded, which is the conservative default.  If the
 * community norm requires inclusion of ex-spouse's children, flip the
 * isActive guard.
 */
function detectAnakTiri(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  const bioChildrenA = new Set(getChildren(aId, family));
  const a = personOf(aId, family);
  const b = personOf(bId, family);

  for (const { spouseId, marriage } of getSpouses(aId, family)) {
    if (!marriage.isActive) continue; // active marriages only — see docstring
    for (const spouseChildId of getChildren(spouseId, family)) {
      if (spouseChildId !== bId) continue;
      if (bioChildrenA.has(bId)) return null; // already A's own child

      const stepChildLabel =
        b?.gender === "male"
          ? "Anak Tiri Lelaki"
          : b?.gender === "female"
            ? "Anak Tiri Perempuan"
            : "Anak Tiri";
      const stepParentLabel =
        a?.gender === "male"
          ? "Bapa Tiri"
          : a?.gender === "female"
            ? "Ibu Tiri"
            : "Ibu/Bapa Tiri";
      return {
        aToB: lbl("tiri", stepParentLabel),
        bToA: lbl("tiri", stepChildLabel),
      };
    }
  }

  // Symmetric: A is B's step-child
  const bioChildrenB = new Set(getChildren(bId, family));
  for (const { spouseId, marriage } of getSpouses(bId, family)) {
    if (!marriage.isActive) continue;
    for (const spouseChildId of getChildren(spouseId, family)) {
      if (spouseChildId !== aId) continue;
      if (bioChildrenB.has(aId)) return null;

      const stepChildLabel =
        a?.gender === "male"
          ? "Anak Tiri Lelaki"
          : a?.gender === "female"
            ? "Anak Tiri Perempuan"
            : "Anak Tiri";
      const stepParentLabel =
        b?.gender === "male"
          ? "Bapa Tiri"
          : b?.gender === "female"
            ? "Ibu Tiri"
            : "Ibu/Bapa Tiri";
      return {
        aToB: lbl("tiri", stepChildLabel),
        bToA: lbl("tiri", stepParentLabel),
      };
    }
  }

  return null;
}

/**
 * Adik-beradik Tiri (blended-family step-sibling).
 *
 * A and B are step-siblings when:
 *   - They share NO biological parent (if they did, they'd be Sebapa/Seibu/Penuh), AND
 *   - A's biological parent is actively married to B's biological parent.
 *
 * This is distinct from Sebapa/Seibu: those share one bio-parent.  Step-siblings
 * share zero bio-parents but live in the same blended household.
 *
 * Edge case (very rare in data): if A and B somehow share a bio-parent AND their
 * other parents are married, they are Adik-beradik Seibu/Sebapa (bio wins).
 * This guard is enforced by calling detectSibling first in getRelationships.
 */
function detectStepSibling(
  aId: string,
  bId: string,
  family: FamilyData,
): { aToB: RelationshipLabel; bToA: RelationshipLabel } | null {
  // Bail if they share any bio parent — that's handled by detectSibling
  if (areSiblings(aId, bId, family)) return null;

  const parentsA = getParents(aId, family);
  const parentsB = getParents(bId, family);

  for (const pA of parentsA) {
    for (const pB of parentsB) {
      if (pA === pB) return null; // shared bio-parent — areSiblings should have caught this
      // Check for active marriage between pA and pB
      const married = family.marriages.some(
        (m) =>
          m.isActive &&
          ((m.husbandId === pA && m.wifeId === pB) ||
            (m.husbandId === pB && m.wifeId === pA)),
      );
      if (married) {
        return {
          aToB: lbl("tiri", "Adik-beradik Tiri"),
          bToA: lbl("tiri", "Adik-beradik Tiri"),
        };
      }
    }
  }

  return null;
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * Compute all applicable Malay kinship labels between two family members.
 *
 * `aToB[i].labelBm` answers "A is B's ___" (e.g. "Anak Lelaki", "Cucu").
 * `bToA[i].labelBm` answers "B is A's ___" (e.g. "Bapa", "Datuk sebelah ibu").
 * Labels are ordered by priority (blood before marriage).
 */
export function getRelationships(
  aId: string,
  bId: string,
  family: FamilyData,
): RelationshipResult {
  if (aId === bId) return { aToB: [], bToA: [] };

  const aToBLabels: RelationshipLabel[] = [];
  const bToALabels: RelationshipLabel[] = [];

  function add(
    pair: { aToB: RelationshipLabel; bToA: RelationshipLabel } | null,
  ) {
    if (!pair) return;
    aToBLabels.push(pair.aToB);
    bToALabels.push(pair.bToA);
  }

  // Priority: blood first, then marriage/tiri. Closer relations listed before distant.
  add(detectParentChild(aId, bId, family));
  add(detectGrandparentGrandchild(aId, bId, family));
  add(detectSibling(aId, bId, family));
  add(detectPakcikAnakSaudara(aId, bId, family));
  add(detectDatukSaudaraCucuSaudara(aId, bId, family));
  add(detectPupu(aId, bId, family));
  // Step relations (tiri) — checked before marriage labels so tiri sibling doesn't
  // masquerade as ipar when a sibling's spouse is also a step-sibling.
  add(detectStepParent(aId, bId, family));
  add(detectAnakTiri(aId, bId, family));
  add(detectStepSibling(aId, bId, family));
  // Marriage-based labels
  add(detectSpouse(aId, bId, family));
  add(detectMertua(aId, bId, family));
  add(detectIpar(aId, bId, family));
  add(detectBiras(aId, bId, family));
  add(detectBesan(aId, bId, family));
  add(detectIparSaudara(aId, bId, family));

  if (aToBLabels.length === 0) return { aToB: [], bToA: [] };

  return {
    aToB: aToBLabels,
    bToA: bToALabels,
    primary: { aToB: aToBLabels[0], bToA: bToALabels[0] },
  };
}

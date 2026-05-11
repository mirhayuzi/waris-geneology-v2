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

  function siblingLabelBm(
    person: Person | undefined,
    isOlder: boolean | null,
  ): string {
    if (isOlder === null) return "Adik-beradik";
    if (isOlder)
      return person?.gender === "male"
        ? "Abang"
        : person?.gender === "female"
          ? "Kakak"
          : "Adik-beradik";
    return "Adik";
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
 * Pupu (Sepupu / Dua Pupu / Tiga Pupu / Empat Pupu).
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
    2: "Dua Pupu",
    3: "Tiga Pupu",
    4: "Empat Pupu",
  };
  return names[degree] ?? `Pupu Darjah ${degree}`;
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

  // Priority: blood first, then marriage. Closer relations listed before distant.
  add(detectParentChild(aId, bId, family));
  add(detectGrandparentGrandchild(aId, bId, family));
  add(detectSibling(aId, bId, family));
  add(detectPakcikAnakSaudara(aId, bId, family));
  add(detectDatukSaudaraCucuSaudara(aId, bId, family));
  add(detectPupu(aId, bId, family));
  add(detectSpouse(aId, bId, family));

  if (aToBLabels.length === 0) return { aToB: [], bToA: [] };

  return {
    aToB: aToBLabels,
    bToA: bToALabels,
    primary: { aToB: aToBLabels[0], bToA: bToALabels[0] },
  };
}

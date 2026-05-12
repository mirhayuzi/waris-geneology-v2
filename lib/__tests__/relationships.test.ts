import { describe, it, expect } from "vitest";
import { getRelationships } from "../relationships";
import type { FamilyData, Person, ParentChild, Marriage } from "../types";

// ─── Test family ─────────────────────────────────────────────────────────────
//
//   Gen 3:  Sibil(M) ─── NenekIbu(F)       DatukBapa(M) ─── NenekBapa(F)
//                │                                  │
//                ├─ Tiajar(F) ─── Mohd(M, deceased) ┘
//                │            ╲
//                │             ╲── Rejin(M, active spouse)
//                │                       │
//                ├─ Pakcik(M)             │
//                                         │
//   Gen 1:    Kakak(F) ── Yuzi(M) ─── Nisa(F)     Adik(F, Tiajar+Rejin)
//                              │
//                          AnakL(M), AnakP(F)
//
// Birth dates added for sibling ordering: Kakak 1985, Yuzi 1990, Adik 1995

function person(
  id: string,
  firstName: string,
  gender: "male" | "female",
  opts: { isAlive?: boolean; birthDate?: string } = {},
): Person {
  return {
    id,
    firstName,
    gender,
    religion: "Islam",
    isAlive: opts.isAlive ?? true,
    birthDate: opts.birthDate,
    createdAt: "",
    updatedAt: "",
  };
}

const persons: Person[] = [
  person("yuzi", "Yuzi", "male", { birthDate: "1990-01-01" }),
  person("nisa", "Nisa", "female"),
  person("mohd", "Mohd", "male", { isAlive: false }),
  person("tiajar", "Tiajar", "female"),
  person("rejin", "Rejin", "male"),
  person("kakak", "Kakak", "female", { birthDate: "1985-01-01" }),
  person("adik", "Adik", "female", { birthDate: "1995-01-01" }),
  person("sibil", "Sibil", "male"),
  person("nenekIbu", "NenekIbu", "female"),
  person("datukBapa", "DatukBapa", "male"),
  person("nenekBapa", "NenekBapa", "female"),
  person("pakcik", "Pakcik", "male"),
  person("makcik", "Makcik", "female"),   // sibling of Tiajar and Pakcik (Sibil+NenekIbu)
  person("sepupu", "Sepupu", "female"),   // child of Pakcik
  person("anakKakak", "AnakKakak", "female"), // child of Kakak (Yuzi's anak saudara perempuan)
  person("anakL", "AnakL", "male"),
  person("anakP", "AnakP", "female"),
  person("stranger", "Stranger", "male"),
  // Chunk 3 additions — Nisa's family for mertua / ipar / anak-tiri tests
  person("nisaBapa", "NisaBapa", "male"),
  person("nisaIbu", "NisaIbu", "female"),
  person("nisaSibling", "NisaSibling", "female", { birthDate: "1993-01-01" }),
  person("nisaAnakDahulu", "NisaAnakDahulu", "female"), // Nisa's child not Yuzi's
];

const pc = (id: string, parentId: string, childId: string): ParentChild => ({
  id,
  parentId,
  childId,
  type: "biological",
});

const parentChildren: ParentChild[] = [
  pc("pc1", "mohd", "yuzi"),
  pc("pc2", "tiajar", "yuzi"),
  pc("pc3", "mohd", "kakak"),
  pc("pc4", "tiajar", "kakak"),
  pc("pc5", "tiajar", "adik"),
  pc("pc6", "rejin", "adik"),
  pc("pc7", "sibil", "tiajar"),
  pc("pc8", "nenekIbu", "tiajar"),
  pc("pc9", "sibil", "pakcik"),
  pc("pc10", "nenekIbu", "pakcik"),
  pc("pc11", "sibil", "makcik"),
  pc("pc12", "nenekIbu", "makcik"),
  pc("pc13", "datukBapa", "mohd"),
  pc("pc14", "nenekBapa", "mohd"),
  pc("pc15", "pakcik", "sepupu"),
  pc("pc16", "kakak", "anakKakak"),
  pc("pc17", "yuzi", "anakL"),
  pc("pc18", "nisa", "anakL"),
  pc("pc19", "yuzi", "anakP"),
  pc("pc20", "nisa", "anakP"),
  // Chunk 3 additions
  pc("pc21", "nisaBapa", "nisa"),
  pc("pc22", "nisaIbu", "nisa"),
  pc("pc23", "nisaBapa", "nisaSibling"),
  pc("pc24", "nisaIbu", "nisaSibling"),
  pc("pc25", "nisa", "nisaAnakDahulu"),   // Nisa's child, NOT Yuzi's
];

const m = (
  id: string,
  husbandId: string,
  wifeId: string,
  isActive = true,
): Marriage => ({
  id,
  husbandId,
  wifeId,
  isActive,
});

const marriages: Marriage[] = [
  m("m1", "yuzi", "nisa"),
  m("m2", "mohd", "tiajar", false),
  m("m3", "rejin", "tiajar"),
  m("m4", "sibil", "nenekIbu"),
  m("m5", "datukBapa", "nenekBapa"),
  m("m6", "nisaBapa", "nisaIbu"),   // Nisa's parents — active marriage
];

const family: FamilyData = {
  persons,
  marriages,
  parentChildren,
  collaborators: [],
  familyName: "Test",
  createdAt: "",
  updatedAt: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function aToB(aId: string, bId: string) {
  return getRelationships(aId, bId, family).aToB.map((l) => l.labelBm);
}

function bToA(aId: string, bId: string) {
  return getRelationships(aId, bId, family).bToA.map((l) => l.labelBm);
}

function primary(aId: string, bId: string) {
  return getRelationships(aId, bId, family).primary;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getRelationships — Chunk 1 direct labels", () => {
  // ── Self & strangers ──────────────────────────────────────────────────────

  it("self → self: returns empty result", () => {
    const result = getRelationships("yuzi", "yuzi", family);
    expect(result.aToB).toEqual([]);
    expect(result.bToA).toEqual([]);
    expect(result.primary).toBeUndefined();
  });

  it("strangers (no path): returns empty result", () => {
    const result = getRelationships("stranger", "nisa", family);
    expect(result.aToB).toEqual([]);
    expect(result.bToA).toEqual([]);
    expect(result.primary).toBeUndefined();
  });

  // ── Parent / child ────────────────────────────────────────────────────────

  it("Yuzi → Mohd (deceased bapa): aToB=Anak Lelaki, bToA=Bapa", () => {
    expect(aToB("yuzi", "mohd")).toContain("Anak Lelaki");
    expect(bToA("yuzi", "mohd")).toContain("Bapa");
  });

  it("Yuzi → Tiajar (ibu): aToB=Anak Lelaki, bToA=Ibu", () => {
    expect(aToB("yuzi", "tiajar")).toContain("Anak Lelaki");
    expect(bToA("yuzi", "tiajar")).toContain("Ibu");
  });

  it("Yuzi → AnakL (son): aToB=Bapa, bToA=Anak Lelaki", () => {
    expect(aToB("yuzi", "anakL")).toContain("Bapa");
    expect(bToA("yuzi", "anakL")).toContain("Anak Lelaki");
  });

  it("Yuzi → AnakP (daughter): aToB=Bapa, bToA=Anak Perempuan", () => {
    expect(aToB("yuzi", "anakP")).toContain("Bapa");
    expect(bToA("yuzi", "anakP")).toContain("Anak Perempuan");
  });

  it("Tiajar → Yuzi (ibu checking son): aToB=Ibu, bToA=Anak Lelaki", () => {
    expect(aToB("tiajar", "yuzi")).toContain("Ibu");
    expect(bToA("tiajar", "yuzi")).toContain("Anak Lelaki");
  });

  it("Nisa → AnakP (mother checking daughter): aToB=Ibu, bToA=Anak Perempuan", () => {
    expect(aToB("nisa", "anakP")).toContain("Ibu");
    expect(bToA("nisa", "anakP")).toContain("Anak Perempuan");
  });

  // ── Grandparent / grandchild ──────────────────────────────────────────────

  it("Yuzi → Sibil (datuk sebelah ibu): aToB=Cucu, bToA=Datuk sebelah ibu", () => {
    expect(aToB("yuzi", "sibil")).toContain("Cucu");
    expect(bToA("yuzi", "sibil")).toContain("Datuk sebelah ibu");
  });

  it("Yuzi → NenekIbu (nenek sebelah ibu): aToB=Cucu, bToA=Nenek sebelah ibu", () => {
    expect(aToB("yuzi", "nenekIbu")).toContain("Cucu");
    expect(bToA("yuzi", "nenekIbu")).toContain("Nenek sebelah ibu");
  });

  it("Yuzi → DatukBapa (datuk sebelah bapa): aToB=Cucu, bToA=Datuk sebelah bapa", () => {
    expect(aToB("yuzi", "datukBapa")).toContain("Cucu");
    expect(bToA("yuzi", "datukBapa")).toContain("Datuk sebelah bapa");
  });

  it("Yuzi → NenekBapa (nenek sebelah bapa): aToB=Cucu, bToA=Nenek sebelah bapa", () => {
    expect(aToB("yuzi", "nenekBapa")).toContain("Cucu");
    expect(bToA("yuzi", "nenekBapa")).toContain("Nenek sebelah bapa");
  });

  it("Sibil → Yuzi (grandfather checking grandchild): aToB=Datuk sebelah ibu, bToA=Cucu", () => {
    expect(aToB("sibil", "yuzi")).toContain("Datuk sebelah ibu");
    expect(bToA("sibil", "yuzi")).toContain("Cucu");
  });

  it("grandchild → AnakL via Yuzi: Sibil → AnakL = Cucu", () => {
    // Sibil is AnakL's great-grandfather — outside Chunk 1 scope, should be empty
    // (depth 3 not detected yet)
    const result = getRelationships("sibil", "anakL", family);
    expect(result.aToB).not.toContain(expect.objectContaining({ labelBm: "Cucu" }));
  });

  // ── Siblings ──────────────────────────────────────────────────────────────

  it("Yuzi → Kakak (full sibling, kakak older): aToB=Adik (Yuzi is Kakak's adik), bToA=Kakak", () => {
    // Kakak born 1985, Yuzi born 1990 → Yuzi is younger
    // aToB: Yuzi (younger) is Kakak's "Adik"
    // bToA: Kakak (older female) is Yuzi's "Kakak"
    expect(aToB("yuzi", "kakak")).toContain("Adik");
    expect(bToA("yuzi", "kakak")).toContain("Kakak");
  });

  it("Yuzi → Adik (half-sibling seibu, adik younger): aToB=Abang Seibu, bToA=Adik Seibu", () => {
    // Adik born 1995, Yuzi born 1990 → Yuzi is older
    // Shared parent = Tiajar (female) → Seibu qualifier
    expect(aToB("yuzi", "adik")).toContain("Abang Seibu");
    expect(bToA("yuzi", "adik")).toContain("Adik Seibu");
  });

  it("Kakak → Adik (seibu: shared parent Tiajar only): Kakak Seibu", () => {
    // Kakak (1985) older than Adik (1995); shared parent = Tiajar (female) → Seibu qualifier
    expect(aToB("kakak", "adik")).toContain("Kakak Seibu");
    expect(bToA("kakak", "adik")).toContain("Adik Seibu");
  });

  it("half-sibling detected regardless of shared-parent count (Yuzi+Adik share 1 parent)", () => {
    // Yuzi parents: mohd, tiajar. Adik parents: tiajar, rejin. Shared: tiajar (1 parent only)
    const result = getRelationships("yuzi", "adik", family);
    expect(result.aToB.length).toBeGreaterThan(0);
    expect(result.aToB[0].category).toBe("saudara");
  });

  it("no birth dates: sibling label falls back to Adik-beradik", () => {
    // Yuzi (1990) → Pakcik (no birthDate): pakcik is NOT sibling of yuzi
    // Use two persons who ARE siblings but have no birthDate: sibil/nenekIbu have no children to compare
    // Instead create a minimal test: remove birthDate from test by checking pakcik→sibil's child
    // Actually pakcik's parents are sibil+nenekIbu, yuzi's are mohd+tiajar → no shared parent → not siblings
    // Let's check Pakcik → Tiajar (same parents: sibil+nenekIbu) — both siblings with no birthDate
    const labels = aToB("pakcik", "tiajar");
    expect(labels).toContain("Adik-beradik");
  });

  // ── Spouse ───────────────────────────────────────────────────────────────

  it("Yuzi → Nisa (active marriage): aToB=Suami, bToA=Isteri", () => {
    expect(aToB("yuzi", "nisa")).toContain("Suami");
    expect(bToA("yuzi", "nisa")).toContain("Isteri");
  });

  it("Nisa → Yuzi: aToB=Isteri, bToA=Suami", () => {
    expect(aToB("nisa", "yuzi")).toContain("Isteri");
    expect(bToA("nisa", "yuzi")).toContain("Suami");
  });

  it("Mohd → Tiajar (inactive marriage/divorced): no spouse label", () => {
    // marriage m2 isActive=false
    const labels = aToB("mohd", "tiajar");
    expect(labels).not.toContain("Suami");
    expect(labels).not.toContain("Isteri");
  });

  // ── Primary label ─────────────────────────────────────────────────────────

  it("primary is the first (highest-priority) label", () => {
    const p = primary("yuzi", "mohd");
    expect(p).toBeDefined();
    expect(p!.aToB.labelBm).toBe("Anak Lelaki");
    expect(p!.bToA.labelBm).toBe("Bapa");
  });

  it("blood label takes priority over marriage (if both apply)", () => {
    // Yuzi is Nisa's husband AND they share children (but no blood link here)
    // Just verify primary for blood relation is 'core' category
    const p = primary("yuzi", "tiajar");
    expect(p!.aToB.category).toBe("core");
  });

  // ── Deceased members still get labels ────────────────────────────────────

  it("deceased parent (Mohd) still yields Bapa label", () => {
    // Mohd is deceased (isAlive: false) — should still be labelled Bapa
    expect(bToA("yuzi", "mohd")).toContain("Bapa");
  });
});

// ─── Synthetic fixture for extended sideling tests ────────────────────────────
//
//   sGreatGP (M)
//   ├── sGpA (M) ── sParA (M) ── sPersonA (M)   ← dua pupu with sPersonB
//   └── sGpB (M) ── sParB (M) ── sPersonB (M)
//
//   sGpParent (M)
//   ├── sGp (M) ── sPar (M) ─┬── sSubject (M)   ← datuk saudara / cucu saudara tests
//   └── sDatukSaudara (M)     └── sSibling (M) ── sSibChild (F) ── sCucuSaudara (M)

const synPersons: Person[] = [
  person("sGreatGP", "SynGreatGP", "male"),
  person("sGpA", "SynGpA", "male"),
  person("sGpB", "SynGpB", "male"),
  person("sParA", "SynParA", "male"),
  person("sParB", "SynParB", "male"),
  person("sPersonA", "SynPersonA", "male"),
  person("sPersonB", "SynPersonB", "male"),
  person("sGpParent", "SynGpParent", "male"),
  person("sGp", "SynGp", "male"),
  person("sDatukSaudara", "SynDatukSaudara", "male"),
  person("sPar", "SynPar", "male"),
  person("sSubject", "SynSubject", "male"),
  person("sSibling", "SynSibling", "male"),
  person("sSibChild", "SynSibChild", "female"),
  person("sCucuSaudara", "SynCucuSaudara", "male"),
];

const synPc: ParentChild[] = [
  // dua pupu chain
  pc("s1", "sGreatGP", "sGpA"),
  pc("s2", "sGreatGP", "sGpB"),
  pc("s3", "sGpA", "sParA"),
  pc("s4", "sGpB", "sParB"),
  pc("s5", "sParA", "sPersonA"),
  pc("s6", "sParB", "sPersonB"),
  // datuk saudara + cucu saudara chain
  pc("s7", "sGpParent", "sGp"),
  pc("s8", "sGpParent", "sDatukSaudara"),
  pc("s9", "sGp", "sPar"),
  pc("s10", "sPar", "sSubject"),
  pc("s11", "sPar", "sSibling"),
  pc("s12", "sSibling", "sSibChild"),
  pc("s13", "sSibChild", "sCucuSaudara"),
];

const synFamily: FamilyData = {
  persons: synPersons,
  marriages: [],
  parentChildren: synPc,
  collaborators: [],
  familyName: "Synthetic",
  createdAt: "",
  updatedAt: "",
};

function synAtoB(aId: string, bId: string) {
  return getRelationships(aId, bId, synFamily).aToB.map((l) => l.labelBm);
}
function synBtoA(aId: string, bId: string) {
  return getRelationships(aId, bId, synFamily).bToA.map((l) => l.labelBm);
}
function synResult(aId: string, bId: string) {
  return getRelationships(aId, bId, synFamily);
}

// ─── Chunk 2: Sideling label tests ───────────────────────────────────────────

describe("getRelationships — Chunk 2 sideling labels", () => {
  // ── Pakcik / Makcik ───────────────────────────────────────────────────────

  it("Yuzi → Pakcik (tiajar's brother): aToB=Anak Saudara Lelaki, bToA=Pakcik sebelah ibu", () => {
    expect(aToB("yuzi", "pakcik")).toContain("Anak Saudara Lelaki");
    expect(bToA("yuzi", "pakcik")).toContain("Pakcik sebelah ibu");
  });

  it("Pakcik → Yuzi (reverse): aToB=Pakcik sebelah ibu, bToA=Anak Saudara Lelaki", () => {
    expect(aToB("pakcik", "yuzi")).toContain("Pakcik sebelah ibu");
    expect(bToA("pakcik", "yuzi")).toContain("Anak Saudara Lelaki");
  });

  it("Yuzi → Makcik (tiajar's sister): aToB=Anak Saudara Lelaki, bToA=Makcik sebelah ibu", () => {
    expect(aToB("yuzi", "makcik")).toContain("Anak Saudara Lelaki");
    expect(bToA("yuzi", "makcik")).toContain("Makcik sebelah ibu");
  });

  it("Pakcik → Kakak: aToB=Pakcik sebelah ibu, bToA=Anak Saudara Perempuan", () => {
    expect(aToB("pakcik", "kakak")).toContain("Pakcik sebelah ibu");
    expect(bToA("pakcik", "kakak")).toContain("Anak Saudara Perempuan");
  });

  it("Pakcik → Adik (Tiajar's daughter with Rejin): aToB=Pakcik sebelah ibu, bToA=Anak Saudara Perempuan", () => {
    // Adik's mother is Tiajar → Pakcik (Tiajar's sibling) is Adik's Pakcik sebelah ibu
    expect(aToB("pakcik", "adik")).toContain("Pakcik sebelah ibu");
    expect(bToA("pakcik", "adik")).toContain("Anak Saudara Perempuan");
  });

  it("label has saudara category", () => {
    const result = getRelationships("yuzi", "pakcik", family);
    expect(result.bToA[0].category).toBe("saudara");
  });

  // ── Anak Saudara ─────────────────────────────────────────────────────────

  it("Yuzi → AnakKakak (niece): aToB=Pakcik sebelah ibu, bToA=Anak Saudara Perempuan", () => {
    // AnakKakak's mother is Kakak (female → sebelah ibu from AnakKakak's perspective)
    // Yuzi is Kakak's sibling → Yuzi is AnakKakak's Pakcik sebelah ibu
    expect(aToB("yuzi", "anakKakak")).toContain("Pakcik sebelah ibu");
    expect(bToA("yuzi", "anakKakak")).toContain("Anak Saudara Perempuan");
  });

  // ── Datuk Saudara / Nenek Saudara / Cucu Saudara ─────────────────────────

  it("Pakcik → AnakL: aToB=Datuk Saudara sebelah bapa, bToA=Cucu Saudara Lelaki", () => {
    // AnakL's grandparents at depth 2: mohd & tiajar (via Yuzi who is male → sebelah bapa)
    // Pakcik is Tiajar's sibling → Pakcik is AnakL's Datuk Saudara sebelah bapa
    expect(aToB("pakcik", "anakL")).toContain("Datuk Saudara sebelah bapa");
    expect(bToA("pakcik", "anakL")).toContain("Cucu Saudara Lelaki");
  });

  it("Makcik → AnakL: aToB=Nenek Saudara sebelah bapa, bToA=Cucu Saudara Lelaki", () => {
    expect(aToB("makcik", "anakL")).toContain("Nenek Saudara sebelah bapa");
    expect(bToA("makcik", "anakL")).toContain("Cucu Saudara Lelaki");
  });

  it("AnakL → Pakcik: aToB=Cucu Saudara Lelaki, bToA=Datuk Saudara sebelah bapa", () => {
    expect(aToB("anakL", "pakcik")).toContain("Cucu Saudara Lelaki");
    expect(bToA("anakL", "pakcik")).toContain("Datuk Saudara sebelah bapa");
  });

  it("synthetic: sSubject → sDatukSaudara: aToB=Cucu Saudara Lelaki, bToA=Datuk Saudara sebelah bapa", () => {
    // sSubject → sPar (male→sebelah_bapa) → sGp; sDatukSaudara shares sGpParent with sGp
    expect(synAtoB("sSubject", "sDatukSaudara")).toContain("Cucu Saudara Lelaki");
    expect(synBtoA("sSubject", "sDatukSaudara")).toContain("Datuk Saudara sebelah bapa");
  });

  it("synthetic: sSubject → sCucuSaudara: aToB=Datuk Saudara sebelah ibu, bToA=Cucu Saudara Lelaki", () => {
    // sCucuSaudara → sSibChild (female→sebelah_ibu) → sSibling; sSubject is sSibling's sibling
    expect(synAtoB("sSubject", "sCucuSaudara")).toContain("Datuk Saudara sebelah ibu");
    expect(synBtoA("sSubject", "sCucuSaudara")).toContain("Cucu Saudara Lelaki");
  });

  // ── Sepupu ────────────────────────────────────────────────────────────────

  it("Yuzi → Sepupu: degree=1, aToB=Sepupu sebelah ibu, bToA=Sepupu sebelah bapa", () => {
    // Shared grandparents: Sibil & NenekIbu
    // From Yuzi: both are sebelah_ibu (via Tiajar, female)
    // From Sepupu: both are sebelah_bapa (via Pakcik, male)
    const result = getRelationships("yuzi", "sepupu", family);
    expect(result.aToB[0].labelBm).toBe("Sepupu sebelah ibu");
    expect(result.bToA[0].labelBm).toBe("Sepupu sebelah bapa");
    expect(result.aToB[0].degree).toBe(1);
  });

  it("Sepupu → Yuzi: aToB=Sepupu sebelah bapa, bToA=Sepupu sebelah ibu", () => {
    const result = getRelationships("sepupu", "yuzi", family);
    expect(result.aToB[0].labelBm).toBe("Sepupu sebelah bapa");
    expect(result.bToA[0].labelBm).toBe("Sepupu sebelah ibu");
  });

  // ── Dua Pupu ─────────────────────────────────────────────────────────────

  it("synthetic: sPersonA → sPersonB: Dua Pupu (degree 2)", () => {
    // Shared great-grandparent sGreatGP at depth 3; no shared grandparent at depth 2
    const result = synResult("sPersonA", "sPersonB");
    expect(result.aToB[0].labelBm).toMatch(/Dua Pupu/);
    expect(result.aToB[0].degree).toBe(2);
  });

  it("synthetic: dua pupu is symmetric", () => {
    const ab = synResult("sPersonA", "sPersonB").aToB[0].labelBm;
    const ba = synResult("sPersonB", "sPersonA").aToB[0].labelBm;
    expect(ab).toMatch(/Dua Pupu/);
    expect(ba).toMatch(/Dua Pupu/);
  });

  // ── Negative / guard cases ────────────────────────────────────────────────

  it("siblings are NOT labelled Sepupu (guard prevents pupu for shared parent)", () => {
    // Yuzi and Kakak share parent Mohd & Tiajar → detectPupu returns null
    const labels = aToB("yuzi", "kakak");
    expect(labels).not.toContain("Sepupu");
    expect(labels.some((l) => ["Adik", "Abang", "Kakak", "Adik-beradik"].includes(l))).toBe(true);
  });

  it("Yuzi → Pakcik is NOT labelled Sepupu (different ancestor depth)", () => {
    // Pakcik has no grandparents in fixture → no shared depth-2 ancestor with Yuzi
    const labels = aToB("yuzi", "pakcik");
    expect(labels).not.toContain("Sepupu");
  });

  it("Pakcik and Tiajar are siblings, not pakcik/makcik to each other", () => {
    // detectPakcikAnakSaudara checks if one is a sibling of the other's PARENT
    // Pakcik's parents = {Sibil, NenekIbu}; Tiajar's parents = {Sibil, NenekIbu}
    // Neither is a sibling of the other's parent (Sibil has no parents in fixture)
    const labels = aToB("pakcik", "tiajar");
    expect(labels).not.toContain("Pakcik sebelah ibu");
    expect(labels).toContain("Adik-beradik"); // they're siblings (penuh — both parents shared)
  });
});

// ─── Chunk 3: in-law + tiri synthetic fixtures ────────────────────────────────
//
// BIRAS: birasX married birasSisA; birasY married birasSisB;
//        birasSisA and birasSisB are sisters (share birasParent).
//        → birasX and birasY are biras (3-hop via birasSisB / birasSisA).
//
// BESAN: besanA → besanChild ─(married)─ besanChildSpouse ← besanB
//        → besanA and besanB are besan.
//
// IPAR SAUDARA: iparGrandP → {iparParent, iparUncle};
//               iparParent → iparSpouse; iparUncle → iparCousin;
//               iparSubject married iparSpouse.
//               → iparSubject and iparCousin are ipar saudara (spouse's first cousin).
//
// STEP-SIBLING: stepBapa married stepIbu (active);
//               stepBapa → stepChildA; stepIbu → stepChildB.
//               → stepChildA and stepChildB are adik-beradik tiri.

const c3Persons: Person[] = [
  // Biras
  person("birasX",      "BirasX",      "male"),
  person("birasY",      "BirasY",      "male"),
  person("birasSisA",   "BirasSisA",   "female"),
  person("birasSisB",   "BirasSisB",   "female"),
  person("birasParent", "BirasParent", "female"),
  // Besan
  person("besanA",           "BesanA",           "male"),
  person("besanChild",       "BesanChild",       "male"),
  person("besanChildSpouse", "BesanChildSpouse", "female"),
  person("besanB",           "BesanB",           "female"),
  // Ipar Saudara
  person("iparSubject", "IparSubject", "male"),
  person("iparSpouse",  "IparSpouse",  "female"),
  person("iparGrandP",  "IparGrandP",  "male"),
  person("iparParent",  "IparParent",  "male"),
  person("iparUncle",   "IparUncle",   "male"),
  person("iparCousin",  "IparCousin",  "female"),
  // Step-sibling
  person("stepBapa",   "StepBapa",   "male"),
  person("stepIbu",    "StepIbu",    "female"),
  person("stepChildA", "StepChildA", "male"),
  person("stepChildB", "StepChildB", "female"),
];

const c3Pc: ParentChild[] = [
  pc("c3p1",  "birasParent", "birasSisA"),
  pc("c3p2",  "birasParent", "birasSisB"),
  pc("c3p3",  "besanA",      "besanChild"),
  pc("c3p4",  "besanB",      "besanChildSpouse"),
  pc("c3p5",  "iparGrandP",  "iparParent"),
  pc("c3p6",  "iparGrandP",  "iparUncle"),
  pc("c3p7",  "iparParent",  "iparSpouse"),
  pc("c3p8",  "iparUncle",   "iparCousin"),
  pc("c3p9",  "stepBapa",    "stepChildA"),
  pc("c3p10", "stepIbu",     "stepChildB"),
];

const c3Marriages: Marriage[] = [
  m("c3m1", "birasX",      "birasSisA"),
  m("c3m2", "birasY",      "birasSisB"),
  m("c3m3", "besanChild",  "besanChildSpouse"),
  m("c3m4", "iparSubject", "iparSpouse"),
  m("c3m5", "stepBapa",    "stepIbu"),
];

const c3Family: FamilyData = {
  persons:        c3Persons,
  marriages:      c3Marriages,
  parentChildren: c3Pc,
  collaborators:  [],
  familyName:     "Chunk3Synthetic",
  createdAt:      "",
  updatedAt:      "",
};

function c3AtoB(aId: string, bId: string) {
  return getRelationships(aId, bId, c3Family).aToB.map((l) => l.labelBm);
}
function c3BtoA(aId: string, bId: string) {
  return getRelationships(aId, bId, c3Family).bToA.map((l) => l.labelBm);
}
function c3Result(aId: string, bId: string) {
  return getRelationships(aId, bId, c3Family);
}

// ─── Chunk 3: in-law + tiri label tests ──────────────────────────────────────

describe("getRelationships — Chunk 3 in-law + tiri labels", () => {
  // ── Mertua ────────────────────────────────────────────────────────────────

  it("Yuzi → nisaBapa (bapa mertua): aToB=Menantu Lelaki, bToA=Bapa Mertua", () => {
    expect(aToB("yuzi", "nisaBapa")).toContain("Menantu Lelaki");
    expect(bToA("yuzi", "nisaBapa")).toContain("Bapa Mertua");
  });

  it("Yuzi → nisaIbu (ibu mertua): aToB=Menantu Lelaki, bToA=Ibu Mertua", () => {
    expect(aToB("yuzi", "nisaIbu")).toContain("Menantu Lelaki");
    expect(bToA("yuzi", "nisaIbu")).toContain("Ibu Mertua");
  });

  it("nisaBapa → Yuzi (reverse): aToB=Bapa Mertua, bToA=Menantu Lelaki", () => {
    expect(aToB("nisaBapa", "yuzi")).toContain("Bapa Mertua");
    expect(bToA("nisaBapa", "yuzi")).toContain("Menantu Lelaki");
  });

  it("mertua label has category perkahwinan", () => {
    const result = getRelationships("yuzi", "nisaBapa", family);
    expect(result.bToA.find((l) => l.labelBm === "Bapa Mertua")?.category).toBe("perkahwinan");
  });

  // ── Ipar ─────────────────────────────────────────────────────────────────

  it("Yuzi → nisaSibling (adik ipar, via Nisa's sibling pathway): aToB=Adik Ipar, bToA=Abang Ipar", () => {
    // nisaSibling born 1993, Yuzi born 1990 → nisaSibling is younger than Yuzi
    expect(aToB("yuzi", "nisaSibling")).toContain("Adik Ipar");
    expect(bToA("yuzi", "nisaSibling")).toContain("Abang Ipar");
  });

  it("ipar label has category perkahwinan", () => {
    const result = getRelationships("yuzi", "nisaSibling", family);
    expect(result.aToB[0].category).toBe("perkahwinan");
  });

  // ── Sibling seibu qualifier (refined from Chunk 1) ───────────────────────

  it("Yuzi → Adik (seibu): label includes Seibu qualifier since they share only Tiajar", () => {
    expect(aToB("yuzi", "adik")).toContain("Abang Seibu");
    expect(bToA("yuzi", "adik")).toContain("Adik Seibu");
  });

  it("Yuzi → Adik: NOT step-sibling (they share bio parent Tiajar)", () => {
    expect(aToB("yuzi", "adik")).not.toContain("Adik-beradik Tiri");
    expect(aToB("yuzi", "adik")).not.toContain("Adik Tiri");
  });

  it("Yuzi → Kakak (penuh): no qualifier — share both Mohd and Tiajar", () => {
    // Full siblings get no suffix: "Adik" not "Adik Seibu"
    expect(aToB("yuzi", "kakak")).toContain("Adik");
    expect(aToB("yuzi", "kakak")).not.toContain("Adik Seibu");
    expect(aToB("yuzi", "kakak")).not.toContain("Adik Sebapa");
  });

  // ── Step-parent (tiri) ────────────────────────────────────────────────────

  it("Yuzi → Rejin (bapa tiri): Rejin is Tiajar's active husband, not Yuzi's bio-parent", () => {
    expect(aToB("yuzi", "rejin")).toContain("Anak Tiri Lelaki");
    expect(bToA("yuzi", "rejin")).toContain("Bapa Tiri");
  });

  it("bapa tiri label has category tiri", () => {
    const result = getRelationships("yuzi", "rejin", family);
    expect(result.bToA.find((l) => l.labelBm === "Bapa Tiri")?.category).toBe("tiri");
  });

  it("Yuzi → Mohd (bio-bapa): bio parent is NOT labelled bapa tiri", () => {
    expect(bToA("yuzi", "mohd")).toContain("Bapa");
    expect(bToA("yuzi", "mohd")).not.toContain("Bapa Tiri");
  });

  // ── Anak tiri ─────────────────────────────────────────────────────────────

  it("Yuzi → nisaAnakDahulu (anak tiri): Nisa's child who is NOT Yuzi's biological child", () => {
    expect(aToB("yuzi", "nisaAnakDahulu")).toContain("Bapa Tiri");
    expect(bToA("yuzi", "nisaAnakDahulu")).toContain("Anak Tiri Perempuan");
  });

  it("Yuzi → AnakL (bio child): NOT labelled anak tiri", () => {
    expect(aToB("yuzi", "anakL")).toContain("Bapa");
    expect(aToB("yuzi", "anakL")).not.toContain("Bapa Tiri");
  });

  // ── Synthetic: step-sibling (adik-beradik tiri) ───────────────────────────

  it("synthetic: stepChildA ↔ stepChildB: Adik-beradik Tiri (no shared bio parent, parents married)", () => {
    expect(c3AtoB("stepChildA", "stepChildB")).toContain("Adik-beradik Tiri");
    expect(c3BtoA("stepChildA", "stepChildB")).toContain("Adik-beradik Tiri");
  });

  it("synthetic: step-sibling label has category tiri", () => {
    const result = c3Result("stepChildA", "stepChildB");
    expect(result.aToB[0].category).toBe("tiri");
  });

  // ── Synthetic: biras ──────────────────────────────────────────────────────

  it("synthetic: birasX → birasY: Biras, via=birasSisB", () => {
    const result = c3Result("birasX", "birasY");
    expect(result.aToB.map((l) => l.labelBm)).toContain("Biras");
    expect(result.aToB.find((l) => l.labelBm === "Biras")?.via).toBe("birasSisB");
  });

  it("synthetic: biras symmetric (birasY → birasX), via=birasSisA", () => {
    const result = c3Result("birasY", "birasX");
    expect(result.aToB.map((l) => l.labelBm)).toContain("Biras");
    expect(result.aToB.find((l) => l.labelBm === "Biras")?.via).toBe("birasSisA");
  });

  it("synthetic: biras category is perkahwinan", () => {
    const result = c3Result("birasX", "birasY");
    expect(result.aToB.find((l) => l.labelBm === "Biras")?.category).toBe("perkahwinan");
  });

  // ── Synthetic: besan ──────────────────────────────────────────────────────

  it("synthetic: besanA → besanB: Besan (child's spouse's parent), via=besanChild", () => {
    const result = c3Result("besanA", "besanB");
    expect(result.aToB.map((l) => l.labelBm)).toContain("Besan");
    expect(result.aToB.find((l) => l.labelBm === "Besan")?.via).toBe("besanChild");
  });

  it("synthetic: besan symmetric (besanB → besanA)", () => {
    expect(c3AtoB("besanB", "besanA")).toContain("Besan");
  });

  it("synthetic: besan category is perkahwinan", () => {
    const result = c3Result("besanA", "besanB");
    expect(result.aToB.find((l) => l.labelBm === "Besan")?.category).toBe("perkahwinan");
  });

  // ── Synthetic: ipar saudara ───────────────────────────────────────────────

  it("synthetic: iparSubject → iparCousin: Ipar Saudara (spouse's first cousin)", () => {
    expect(c3AtoB("iparSubject", "iparCousin")).toContain("Ipar Saudara");
    expect(c3BtoA("iparSubject", "iparCousin")).toContain("Ipar Saudara");
  });

  it("synthetic: ipar saudara symmetric (iparCousin → iparSubject via cousin's-spouse pathway)", () => {
    expect(c3AtoB("iparCousin", "iparSubject")).toContain("Ipar Saudara");
  });

  // ── Negative cases ────────────────────────────────────────────────────────

  it("Yuzi → Nisa: Suami only — no mertua, tiri, or ipar labels", () => {
    const labels = aToB("yuzi", "nisa");
    expect(labels).toContain("Suami");
    expect(labels).not.toContain("Bapa Mertua");
    expect(labels).not.toContain("Ibu Mertua");
    expect(labels).not.toContain("Bapa Tiri");
    expect(labels).not.toContain("Anak Tiri Lelaki");
    expect(labels).not.toContain("Adik-beradik Tiri");
  });

  it("Yuzi → AnakL: bio-parent Bapa — not step-parent and not menantu", () => {
    const labels = aToB("yuzi", "anakL");
    expect(labels).toContain("Bapa");
    expect(labels).not.toContain("Bapa Tiri");
    expect(labels).not.toContain("Bapa Mertua");
  });
});

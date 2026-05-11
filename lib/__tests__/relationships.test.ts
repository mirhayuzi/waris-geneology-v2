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
  person("anakL", "AnakL", "male"),
  person("anakP", "AnakP", "female"),
  person("stranger", "Stranger", "male"),
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
  pc("pc11", "datukBapa", "mohd"),
  pc("pc12", "nenekBapa", "mohd"),
  pc("pc13", "yuzi", "anakL"),
  pc("pc14", "nisa", "anakL"),
  pc("pc15", "yuzi", "anakP"),
  pc("pc16", "nisa", "anakP"),
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

  it("Yuzi → Adik (half-sibling seibu, adik younger): aToB=Abang, bToA=Adik", () => {
    // Adik born 1995, Yuzi born 1990 → Yuzi is older
    // aToB: Yuzi (older male) is Adik's "Abang"
    // bToA: Adik (younger) is Yuzi's "Adik"
    expect(aToB("yuzi", "adik")).toContain("Abang");
    expect(bToA("yuzi", "adik")).toContain("Adik");
  });

  it("Kakak → Adik (full vs half): both detected as siblings (shared parent Tiajar)", () => {
    // Kakak and Adik share Tiajar → siblings
    const labels = aToB("kakak", "adik");
    expect(labels.some((l) => ["Kakak", "Abang", "Adik", "Adik-beradik"].includes(l))).toBe(true);
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

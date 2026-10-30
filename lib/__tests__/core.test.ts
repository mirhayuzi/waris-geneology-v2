import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup } from "../backup";
import { ageAt, formatDate, parseInput, toInput } from "../dates";
import { toGedcom } from "../gedcom";
import { FamilyGraph } from "../graph";
import { connectionPath, describePath, describeVia, familySide, relationships } from "../kinship";
import { fatherCandidates, possibleDuplicates } from "../match";
import { DEFAULT_OPTIONS, layoutTree } from "../layout";
import { convertLegacy } from "../legacy";
import { fullName } from "../model";
import { MemoryRepo } from "../repo";
import { family } from "./fixture";

const graph = () => new FamilyGraph(family());
const rel = (a: string, b: string) => relationships(graph(), a, b).map((k) => `${k.en} / ${k.bm}`);

describe("dates", () => {
  it("parses day-first Malaysian input and partial dates", () => {
    expect(parseInput("12/3/1982")).toBe("1982-03-12");
    expect(parseInput("12-03-1982")).toBe("1982-03-12");
    expect(parseInput("3/1982")).toBe("1982-03");
    expect(parseInput("1982")).toBe("1982");
    expect(parseInput("~1950")).toBe("~1950");
    expect(parseInput("lebih kurang 1950")).toBe("~1950");
    expect(parseInput("1982-03-12")).toBe("1982-03-12");
    expect(parseInput("")).toBe("");
  });
  it("rejects impossible dates", () => {
    expect(parseInput("31/2/2020")).toBeNull();
    expect(parseInput("abc")).toBeNull();
    expect(parseInput("13/13/2020")).toBeNull();
  });
  it("formats and round-trips", () => {
    expect(formatDate("1982-03-12", "en")).toBe("12 Mar 1982");
    expect(formatDate("1982-08", "bm")).toBe("Ogo 1982");
    expect(formatDate("~1950", "en")).toBe("c. 1950");
    expect(toInput("1982-03-12")).toBe("12/3/1982");
    expect(parseInput(toInput("~1950-04")!)).toBe("~1950-04");
  });
  it("works out age", () => {
    expect(ageAt("1982-03-12", "2026-03-11")).toBe(43);
    expect(ageAt("1982-03-12", "2026-03-12")).toBe(44);
    expect(ageAt("1982", "2026")).toBe(44);
  });
});

describe("names", () => {
  it("adds bin/binti from the father's name", () => {
    expect(fullName({ givenName: "Mirhayuzi", fatherName: "Mohammad", sex: "male" })).toBe("Mirhayuzi bin Mohammad");
    expect(fullName({ prefix: "Hajjah", givenName: "Siti", fatherName: "Sibil", sex: "female" })).toBe("Hajjah Siti binti Sibil");
  });
});

describe("graph", () => {
  it("finds parents, siblings (full and half) and children in birth order", () => {
    const g = graph();
    expect(g.father("mirhayuzi")?.id).toBe("mohammad");
    expect(g.mother("mirhayuzi")?.id).toBe("siti");
    const sibs = g.siblings("mirhayuzi").map((s) => `${s.person.id}${s.half ? "*" : ""}`);
    expect(sibs).toEqual(["aishah", "bakar*"]);
    expect(g.children("mirhayuzi").map((p) => p.id)).toEqual(["fatimah", "haffizuddin"]);
    expect(g.isAncestor("norbidin", "fatimah")).toBe(true);
    expect(g.isAncestor("fatimah", "norbidin")).toBe(false);
  });
});

describe("kinship", () => {
  it("names blood relatives in English and Malay", () => {
    expect(rel("mirhayuzi", "mohammad")).toEqual(["father / bapa"]);
    expect(rel("mirhayuzi", "norbidin")).toEqual(["grandfather / datuk"]);
    expect(rel("fatimah", "norbidin")).toEqual(["great-grandfather / moyang lelaki"]);
    expect(rel("mirhayuzi", "fatimah")).toEqual(["daughter / anak perempuan"]);
    expect(rel("norbidin", "haffizuddin")).toEqual(["great-grandson / cicit"]);
    expect(rel("mirhayuzi", "aishah")).toEqual(["sister / kakak"]);
    expect(rel("mirhayuzi", "bakar")).toEqual(["half-brother / adik sebapa"]);
    expect(rel("mirhayuzi", "ali")).toEqual(["uncle / bapa saudara"]);
    expect(rel("ali", "mirhayuzi")).toEqual(["nephew / anak saudara"]);
    expect(rel("mirhayuzi", "razak")).toEqual(["first cousin / sepupu"]);
    expect(rel("fatimah", "razak")).toEqual(["first cousin once removed / sepupu (1 generasi ke atas)"]);
  });
  it("names relatives by marriage", () => {
    expect(rel("mirhayuzi", "nisa")).toEqual(["wife / isteri"]);
    expect(rel("nisa", "mohammad")).toEqual(["father-in-law / bapa mertua"]);
    expect(rel("mohammad", "nisa")).toEqual(["daughter-in-law / menantu"]);
    expect(rel("mirhayuzi", "nisadad")).toEqual(["father-in-law / bapa mertua"]);
    expect(rel("mirhayuzi", "zaitun")).toEqual(["aunt (by marriage) / ibu saudara (melalui perkahwinan)"]);
    expect(rel("nisa", "aishah")).toEqual(["sister-in-law / kakak ipar"]);
  });
  it("reports cousin marriages as both", () => {
    const f = family();
    f.unions.push({ id: "u9", partnerA: "razak", partnerB: "aishah", status: "married", sortOrder: 0 });
    const r = relationships(new FamilyGraph(f), "aishah", "razak").map((k) => k.en);
    expect(r).toEqual(["husband", "first cousin"]);
  });
  it("names step, adoptive and milk parents", () => {
    const f = family();
    f.links.push({ id: "x", parentId: "zaitun", childId: "bakar", kind: "milk" });
    f.links.push({ id: "y", parentId: "ali", childId: "fatimah", kind: "adopted" });
    const g = new FamilyGraph(f);
    expect(relationships(g, "bakar", "zaitun")[0].bm).toBe("ibu susuan");
    expect(relationships(g, "fatimah", "ali")[0].bm).toBe("bapa angkat");
    expect(relationships(g, "ali", "fatimah")[0].bm).toBe("anak angkat");
  });
});

describe("tree layout", () => {
  it("places ancestors above, focus in the middle and children below", () => {
    const l = layoutTree(graph(), "mirhayuzi", DEFAULT_OPTIONS)!;
    const card = (id: string) => l.cards.find((c) => c.person?.id === id)!;
    const focus = l.cards.find((c) => c.focus)!;
    expect(focus.person!.id).toBe("mirhayuzi");
    expect(card("mohammad").y).toBeLessThan(focus.y);
    expect(card("norbidin").y).toBeLessThan(card("mohammad").y);
    expect(card("mohammad").x).toBeLessThan(card("siti").x); // father left, mother right
    expect(card("norbidin").x).toBeLessThan(card("sibil").x); // father's side on the left
    expect(card("nisa").y + card("nisa").h).toBe(focus.y + focus.h);
    expect(card("fatimah").y).toBeGreaterThan(focus.y + focus.h);
    expect(card("fatimah").x).toBeLessThan(card("haffizuddin").x);
    // placeholders: Mohammad's line goes up to Norbidin; Siti's mother is unknown
    const adds = l.cards.filter((c) => c.add).map((c) => `${c.add!.role}:${c.add!.of}`);
    expect(adds).toContain("mother:siti");
    expect(adds).toContain("spouse:fatimah");
    // everything on-canvas, nothing overlapping in the same row
    for (const c of l.cards) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(l.width);
      expect(c.y + c.h).toBeLessThanOrEqual(l.height);
    }
    for (const a of l.cards)
      for (const b of l.cards) {
        if (a === b || a.y !== b.y) continue;
        expect(a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01).toBe(true);
      }
  });
  it("respects generation limits and hides placeholders", () => {
    const l = layoutTree(graph(), "fatimah", { up: 1, down: 0, showAdd: false })!;
    expect(l.cards.map((c) => c.person?.id).sort()).toEqual(["fatimah", "mirhayuzi", "nisa"]);
  });
  it("handles a lone person", () => {
    const l = layoutTree(new FamilyGraph({ ...family(), links: [], unions: [] }), "nisa")!;
    expect(l.cards.filter((c) => c.person).length).toBe(1);
    expect(l.cards.filter((c) => c.add).map((c) => c.add!.role).sort()).toEqual(["father", "mother", "spouse"]);
  });
  it("groups children under the right partner when there are two wives", () => {
    const f = family();
    f.persons.push({ ...f.persons[0], id: "wife2", sex: "female", givenName: "W2" });
    f.persons.push({ ...f.persons[0], id: "kid2", sex: "male", givenName: "K2", birthDate: "2020" });
    f.unions.push({ id: "u5", partnerA: "mirhayuzi", partnerB: "wife2", status: "married", sortOrder: 1 });
    f.links.push({ id: "k1", parentId: "mirhayuzi", childId: "kid2", kind: "birth" }, { id: "k2", parentId: "wife2", childId: "kid2", kind: "birth" });
    const l = layoutTree(new FamilyGraph(f), "mirhayuzi")!;
    const x = (id: string) => l.cards.find((c) => c.person?.id === id && !c.key.startsWith("partner"))!.x;
    expect(x("kid2")).toBeGreaterThan(x("haffizuddin"));
  });
});

describe("legacy migration", () => {
  it("converts old AsyncStorage data", () => {
    const { snapshot, photos } = convertLegacy({
      persons: [
        { id: "a", firstName: "Mohammad", binBinti: "Norbidin", gender: "male", isAlive: false, birthDate: "1950-01-02", photo: "file:///x.jpg", religion: "Islam", icNumber: "123" },
        { id: "b", firstName: "Siti", gender: "female", isAlive: true, birthDate: "2020-05-05T00:00:00.000Z", religion: "Christianity" },
      ],
      marriages: [{ id: "m", husbandId: "a", wifeId: "b", isActive: true }],
      parentChildren: [{ id: "x", parentId: "a", childId: "zz", type: "biological" }],
      rootPersonId: "a",
      familyName: "My Family",
    });
    expect(snapshot.persons[0]).toMatchObject({ givenName: "Mohammad", fatherName: "Norbidin", living: false, notes: "IC: 123" });
    expect(snapshot.persons[1]).toMatchObject({ birthDate: "2020-05-05", religion: "Kristian" });
    expect(snapshot.unions).toHaveLength(1);
    expect(snapshot.links).toHaveLength(0); // child "zz" doesn't exist
    expect(snapshot.homePersonId).toBe("a");
    expect(snapshot.familyName).toBe("");
    expect(photos).toEqual({ a: "file:///x.jpg" });
  });
});

describe("backup", () => {
  it("round-trips through JSON and drops broken links", async () => {
    const f = family();
    f.links.push({ id: "bad", parentId: "ghost", childId: "nisa", kind: "birth" });
    const text = JSON.stringify(buildBackup(f, { "p.jpg": "AAAA" }));
    const parsed = parseBackup(text);
    expect(parsed.data.persons).toHaveLength(f.persons.length);
    expect(parsed.data.links).toHaveLength(f.links.length - 1);
    expect(parsed.photos).toEqual({ "p.jpg": "AAAA" });
    const repo = new MemoryRepo();
    await repo.replaceAll(parsed.data);
    expect((await repo.load()).homePersonId).toBe("mirhayuzi");
  });
  it("accepts the old app's JSON backup and rejects junk", () => {
    const parsed = parseBackup(JSON.stringify({ persons: [{ id: "a", firstName: "A", gender: "male" }], marriages: [], parentChildren: [] }));
    expect(parsed.data.persons[0].givenName).toBe("A");
    expect(() => parseBackup("{}")).toThrow();
    expect(() => parseBackup("not json")).toThrow();
  });
});

describe("repo", () => {
  it("deleting a person removes their links and marriages", async () => {
    const repo = new MemoryRepo();
    await repo.replaceAll(family());
    await repo.deletePerson("mirhayuzi");
    const s = await repo.load();
    expect(s.links.some((l) => l.parentId === "mirhayuzi" || l.childId === "mirhayuzi")).toBe(false);
    expect(s.unions.some((u) => u.partnerA === "mirhayuzi" || u.partnerB === "mirhayuzi")).toBe(false);
    expect(s.homePersonId).toBeUndefined();
  });
});

describe("gedcom", () => {
  it("writes individuals and families", () => {
    const ged = toGedcom(family());
    expect(ged.startsWith("0 HEAD")).toBe(true);
    expect(ged.trim().endsWith("0 TRLR")).toBe(true);
    expect(ged).toContain("1 NAME mirhayuzi //");
    expect(ged).toContain("2 DATE 12 MAR 1982");
    expect((ged.match(/ FAM$/gm) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(ged).toMatch(/1 HUSB @I\d+@\n1 WIFE @I\d+@\n1 CHIL/);
  });
  it("can hide living people", () => {
    const ged = toGedcom(family(), { includeLiving: false });
    expect(ged).not.toContain("NAME mirhayuzi");
    expect(ged).toContain("NAME norbidin");
  });
});

describe("connections", () => {
  // Halimah is Mohammad's sister; Mariati is Siti's mother (Mirhayuzi's maternal grandmother)
  const withInLaws = () => {
    const s = family();
    const t = "2026-01-01T00:00:00.000Z";
    s.persons.push({ id: "halimah", givenName: "Halimah", fatherName: "Norbidin", sex: "female", birthDate: "1953", living: true, createdAt: t, updatedAt: t });
    s.persons.push({ id: "mariati", givenName: "Mariati", sex: "female", birthDate: "1930", living: false, createdAt: t, updatedAt: t });
    s.links.push({ id: "n>h", parentId: "norbidin", childId: "halimah", kind: "birth" });
    s.links.push({ id: "a>h", parentId: "aminah", childId: "halimah", kind: "birth" });
    s.links.push({ id: "m>s", parentId: "mariati", childId: "siti", kind: "birth" });
    s.unions.push({ id: "u5", partnerA: "sibil", partnerB: "mariati", status: "married", sortOrder: 0 });
    return new FamilyGraph(s);
  };

  it("finds a path through marriages and describes each step", () => {
    const g = withInLaws();
    const path = connectionPath(g, "halimah", "mariati")!;
    expect(path.ids).toHaveLength(5);
    expect([path.ids[0], ...path.ids.slice(2)]).toEqual(["halimah", "mohammad", "siti", "mariati"]);
    const steps = describePath(g, path);
    expect(steps.map((s) => s.to.id)).toEqual(["mohammad", "siti", "mariati"]);
    expect(steps.map((s) => s.kin.bm)).toEqual(["abang", "isteri", "ibu"]);
  });

  it("names the link through a go-between when there is no single word", () => {
    const g = withInLaws();
    expect(relationships(g, "halimah", "mariati")).toEqual([]);
    const hm = describeVia(g, "halimah", "mariati")!;
    expect(hm.bm).toBe("ibu mertua kepada abang Halimah");
    expect(hm.en).toBe("mother-in-law of Halimah's brother");
    const mh = describeVia(g, "mariati", "halimah")!;
    expect(mh.via.id).toBe("siti");
    expect(mh.bm).toBe("adik ipar kepada anak perempuan Mariati");
  });

  it("knows besan and which side of the family", () => {
    const g = withInLaws();
    expect(relationships(g, "mariati", "norbidin").map((k) => k.bm)).toContain("besan");
    expect(relationships(g, "norbidin", "sibil").map((k) => k.bm)).toContain("besan");
    expect(familySide(g, "mirhayuzi", "halimah")).toBe("father");
    expect(familySide(g, "mirhayuzi", "mariati")).toBe("mother");
    expect(familySide(g, "mirhayuzi", "mohammad")).toBeUndefined();
    expect(connectionPath(g, "mirhayuzi", "nobody")).toBeNull();
  });

  it("counts descendants once per generation", () => {
    const g = withInLaws();
    const gens = g.descendantsByGeneration("norbidin");
    expect(gens.map((x) => x.length)).toEqual([2, 3, 2]); // mohammad, halimah | mirhayuzi, aishah, bakar | fatimah, haffizuddin
    expect(gens[0].map((p) => p.id)).toEqual(["mohammad", "halimah"]);
  });
});

describe("matching", () => {
  it("suggests fathers by name and skips women and descendants", () => {
    const g = new FamilyGraph(family());
    expect(fatherCandidates(g, "moha").map((p) => p.id)).toEqual(["mohammad"]);
    expect(fatherCandidates(g, "siti")).toEqual([]);
    expect(fatherCandidates(g, "haff", "mirhayuzi")).toEqual([]); // his own son
    expect(fatherCandidates(g, "a")).toEqual([]); // too short
  });

  it("flags likely duplicates but not different people with the same name", () => {
    const g = new FamilyGraph(family());
    expect(possibleDuplicates(g, { givenName: "Razak", sex: "male", birthDate: "1988" }).map((p) => p.id)).toEqual(["razak"]);
    expect(possibleDuplicates(g, { givenName: "razak", sex: "male", fatherName: "Ali" }).map((p) => p.id)).toEqual(["razak"]);
    expect(possibleDuplicates(g, { givenName: "Razak", sex: "male", fatherName: "Hassan" })).toEqual([]);
    expect(possibleDuplicates(g, { givenName: "Razak", sex: "male", birthDate: "1950" })).toEqual([]);
    expect(possibleDuplicates(g, { givenName: "Razak", sex: "female" })).toEqual([]);
  });
});

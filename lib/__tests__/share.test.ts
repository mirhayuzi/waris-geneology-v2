import { describe, expect, it } from "vitest";
import { FamilyGraph } from "../graph";
import { unlinkedPeople } from "../match";
import { duplicatePairs, joinPersons, mergeSnapshots, pairKey, prepareShare } from "../merge";
import type { FamilySnapshot, Person } from "../model";
import { printGroups, printHtml } from "../printlist";
import { family } from "./fixture";

const T0 = "2026-01-01T00:00:00.000Z";
const T1 = "2026-06-01T00:00:00.000Z";
const person = (id: string, extra: Partial<Person> = {}): Person => ({ id, givenName: id, sex: "male", living: true, createdAt: T0, updatedAt: T0, ...extra });
const ids = (ps: { id: string }[]) => ps.map((p) => p.id).sort();

describe("sharing", () => {
  it("hides living people's details but keeps the deceased and all links", () => {
    const s = family();
    s.persons.find((p) => p.id === "mirhayuzi")!.phone = "012";
    s.persons.find((p) => p.id === "norbidin")!.birthPlace = "Papar";
    const out = prepareShare(s, { hideLiving: true });
    const me = out.persons.find((p) => p.id === "mirhayuzi")!;
    expect(me.birthDate).toBeUndefined();
    expect(me.phone).toBeUndefined();
    expect(me.givenName).toBe("mirhayuzi");
    expect(out.persons.find((p) => p.id === "norbidin")!.birthPlace).toBe("Papar");
    expect(out.links).toEqual(s.links);
    expect(prepareShare(s, { hideLiving: false })).toBe(s);
  });
});

describe("merge", () => {
  it("adds new people, never doubles shared ones, and keeps links", () => {
    const mine = family();
    const theirs = family();
    theirs.persons.push(person("cousin", { birthDate: "1990" }));
    theirs.links.push({ id: "razak>cousin", parentId: "razak", childId: "cousin", kind: "birth" });
    const m = mergeSnapshots(mine, theirs);
    expect(m.added).toBe(1);
    expect(m.updated).toBe(0);
    expect(m.snapshot.persons).toHaveLength(mine.persons.length + 1);
    expect(m.snapshot.links).toHaveLength(mine.links.length + 1);
    expect(m.snapshot.unions).toHaveLength(mine.unions.length);
  });

  it("takes the newer edit but never lets an empty field wipe a filled one", () => {
    const mine = family();
    const theirs = family();
    const myMe = mine.persons.find((p) => p.id === "mirhayuzi")!;
    myMe.phone = "012";
    myMe.photo = "me.jpg";
    const theirMe = theirs.persons.find((p) => p.id === "mirhayuzi")!;
    theirMe.occupation = "Engineer";
    theirMe.updatedAt = T1;
    delete theirMe.birthDate; // e.g. a file shared with hidden details
    const m = mergeSnapshots(mine, theirs);
    const me = m.snapshot.persons.find((p) => p.id === "mirhayuzi")!;
    expect(me.occupation).toBe("Engineer");
    expect(me.phone).toBe("012");
    expect(me.birthDate).toBe("1982-03-12");
    expect(me.photo).toBe("me.jpg");
    expect(m.updated).toBe(1);
  });

  it("does not create a second marriage record for the same couple", () => {
    const mine = family();
    const theirs = family();
    theirs.unions = theirs.unions.map((u) => (u.id === "u3" ? { ...u, id: "other-id", startDate: "2012" } : u));
    const m = mergeSnapshots(mine, theirs);
    const couple = m.snapshot.unions.filter((u) => pairKey(u.partnerA, u.partnerB) === pairKey("mirhayuzi", "nisa"));
    expect(couple).toHaveLength(1);
    expect(couple[0].startDate).toBe("2012");
  });
});

describe("duplicates", () => {
  // A relative typed Ali again, with his own wife and son
  const withCopy = (): FamilySnapshot => {
    const s = family();
    s.persons.push(person("ali2", { givenName: "Ali", birthDate: "1958" }), person("rahim", { birthDate: "1995" }));
    s.links.push({ id: "ali2>rahim", parentId: "ali2", childId: "rahim", kind: "birth" });
    s.unions.push({ id: "u9", partnerA: "ali2", partnerB: "zaitun", status: "married", sortOrder: 0 });
    return s;
  };

  it("finds the same person typed twice, and can be told they differ", () => {
    const s = withCopy();
    s.persons.find((p) => p.id === "ali")!.givenName = "Ali";
    const g = new FamilyGraph(s);
    const pairs = duplicatePairs(g);
    expect(pairs.map(([a, b]) => pairKey(a.id, b.id))).toEqual([pairKey("ali", "ali2")]);
    expect(duplicatePairs(g, new Set([pairKey("ali", "ali2")]))).toEqual([]);
  });

  it("joins two records: children and marriages move over, no doubles", () => {
    const s = withCopy();
    const out = joinPersons(s, "ali", "ali2");
    const g = new FamilyGraph(out);
    expect(g.get("ali2")).toBeUndefined();
    expect(ids(g.children("ali"))).toEqual(["rahim", "razak"]);
    expect(g.partners("ali").map((p) => p.id)).toEqual(["zaitun"]); // same wife, one marriage
    expect(ids(g.parents("ali"))).toEqual(["sibil"]);
  });
});

describe("needs linking", () => {
  it("lists people whose bin/binti matches an unlinked man in the tree", () => {
    const s = family();
    s.persons.push(person("orphan", { givenName: "Hasnah", sex: "female", fatherName: "Razak", birthDate: "2015" }));
    s.persons.push(person("toosoon", { givenName: "Old", fatherName: "Razak", birthDate: "1950" }));
    const list = unlinkedPeople(new FamilyGraph(s));
    expect(list.map((x) => x.person.id)).toEqual(["orphan"]); // Razak (1988) can't father someone born 1950
    expect(list[0].candidates.map((p) => p.id)).toEqual(["razak"]);
  });
});

describe("print list", () => {
  const g = new FamilyGraph(family());

  it("goes up from the start person and includes cousins when asked", () => {
    const groups = printGroups(g, { startId: "mirhayuzi", up: 1, down: Infinity, relatives: true, order: "top" });
    expect(groups.map((x) => x.gen)).toEqual([-1, 0, 1]);
    expect(ids(groups[0].people)).toEqual(["mohammad", "siti"]);
    expect(ids(groups[1].people)).toEqual(["aishah", "bakar", "mirhayuzi"]);
    expect(ids(groups[2].people)).toEqual(["fatimah", "haffizuddin"]);
  });

  it("direct line only, limited down, youngest first", () => {
    const groups = printGroups(g, { startId: "mirhayuzi", up: 2, down: 0, relatives: false, order: "bottom" });
    expect(groups.map((x) => x.gen)).toEqual([0, -1, -2]);
    expect(ids(groups[1].people)).toEqual(["mohammad", "siti"]);
    expect(ids(groups[2].people)).toEqual(["aminah", "norbidin", "sibil"]);
  });

  it("escapes names in the printed page", () => {
    const html = printHtml([{ label: "G1", rows: [{ name: "A <b>", relation: "", born: "", died: "", spouses: "", descendants: "", living: true }] }], {
      title: "T",
      subtitle: "S",
      footer: "F",
      showSpouses: false,
      cols: { no: "No", name: "Name", relation: "R", born: "B", died: "D", spouse: "Sp", desc: "De" },
    });
    expect(html).toContain("A &lt;b&gt;");
    expect(html).not.toContain("<th>Sp</th>");
  });
});

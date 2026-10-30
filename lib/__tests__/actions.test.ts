import { describe, expect, it } from "vitest";
import { addRelative, RuleError, suggestFatherName } from "../actions";
import { FamilyGraph } from "../graph";
import { MemoryRepo } from "../repo";
import { family } from "./fixture";

async function setup() {
  const repo = new MemoryRepo();
  await repo.replaceAll(family());
  const graph = async () => new FamilyGraph(await repo.load());
  return { repo, graph };
}
const draft = (givenName: string, sex: "male" | "female") => ({ draft: { givenName, sex, living: true } });

describe("adding relatives", () => {
  it("adds a mother and marries her to the existing father", async () => {
    const { repo, graph } = await setup();
    const id = await addRelative(repo, await graph(), { role: "mother", of: "sibil", person: draft("Mak", "female") });
    // sibil has no father, so no marriage is made; add a father to Nisa's dad instead
    const g = await graph();
    expect(g.mother("sibil")?.id).toBe(id);
    const m = await addRelative(repo, g, { role: "mother", of: "nisa", person: draft("Ibu Nisa", "female") });
    const g2 = await graph();
    expect(g2.unionBetween(m, "nisadad")).toBeTruthy();
  });

  it("refuses a second birth father and loops", async () => {
    const { repo, graph } = await setup();
    await expect(addRelative(repo, await graph(), { role: "father", of: "mirhayuzi", person: draft("X", "male") })).rejects.toBeInstanceOf(RuleError);
    await expect(addRelative(repo, await graph(), { role: "father", of: "norbidin", person: { id: "fatimah" } })).rejects.toMatchObject({ key: "wouldLoop" });
    // an adoptive father is fine
    await addRelative(repo, await graph(), { role: "father", of: "mirhayuzi", person: draft("Angkat", "male"), kind: "adopted" });
  });

  it("adds a child to a couple and a sibling to both parents", async () => {
    const { repo, graph } = await setup();
    const g = await graph();
    expect(suggestFatherName(g, { role: "child", of: "nisa", otherParentId: "mirhayuzi" })).toBe("mirhayuzi");
    const kid = await addRelative(repo, g, { role: "child", of: "mirhayuzi", otherParentId: "nisa", person: draft("Baby", "female") });
    const sib = await addRelative(repo, await graph(), { role: "sibling", of: kid, person: draft("Sib", "male") });
    const g2 = await graph();
    expect(g2.parents(sib).map((p) => p.id).sort()).toEqual(["mirhayuzi", "nisa"]);
    expect(g2.siblings(kid).map((s) => s.person.id)).toContain(sib);
  });

  it("links an existing person as spouse (cousin marriage) once", async () => {
    const { repo, graph } = await setup();
    await addRelative(repo, await graph(), { role: "spouse", of: "razak", person: { id: "aishah" }, union: { status: "married" } });
    await expect(addRelative(repo, await graph(), { role: "spouse", of: "aishah", person: { id: "razak" } })).rejects.toMatchObject({ key: "alreadyLinked" });
  });

  it("needs parents before adding a sibling", async () => {
    const { repo, graph } = await setup();
    await expect(addRelative(repo, await graph(), { role: "sibling", of: "norbidin", person: draft("S", "male") })).rejects.toMatchObject({ key: "addFirstParents" });
  });
});

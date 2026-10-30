import { expect, it } from "vitest";
import { FamilyGraph } from "../graph";
import { badgesOf, branchPhotos, generationOf } from "../hero";
import { family } from "./fixture";

it("counts generations from the oldest ancestor", () => {
  const g = new FamilyGraph(family());
  expect(generationOf(g, "norbidin")).toEqual({ gen: 1 });
  const me = generationOf(g, "mirhayuzi");
  expect(me.gen).toBe(3);
  expect(me.from?.id).toBe("norbidin"); // father's line first
  expect(generationOf(g, "fatimah").gen).toBe(4);
});

it("works out branch photo completeness and badges", () => {
  const s = family();
  s.persons.find((p) => p.id === "mirhayuzi")!.photo = "a.jpg";
  s.persons.find((p) => p.id === "fatimah")!.photo = "b.jpg";
  s.persons.find((p) => p.id === "mirhayuzi")!.birthPlace = "Kota Kinabalu";
  const g = new FamilyGraph(s);
  expect(branchPhotos(g, "mirhayuzi")).toEqual({ withPhoto: 2, total: 3 });
  expect(badgesOf(g, g.get("mirhayuzi")!)).toEqual([{ key: "parentOf", n: 2 }, { key: "birthplace", text: "Kota Kinabalu" }]);
  const nor = badgesOf(g, g.get("norbidin")!).map((b) => b.key);
  expect(nor).toEqual(["head", "parentOf", "generations", "deceased"]);
});
